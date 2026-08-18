import { useState, useEffect } from 'react';
import { Plus, Edit3, X, Phone, Mail, Globe, User, Building2 } from 'lucide-react';

import type {
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerStage,
} from '@shared/api.interface';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  customer?: Customer | null;
  onSubmit: (data: CreateCustomerRequest | UpdateCustomerRequest) => void;
  loading: boolean;
}

const STAGE_OPTIONS: Array<{ value: CustomerStage; label: string }> = [
  { value: 'UNCONTACTED', label: '未联系' },
  { value: 'ADDED', label: '已添加' },
  { value: 'COMMUNICATING', label: '沟通中' },
  { value: 'INTERESTED', label: '意向客户' },
  { value: 'CLOSED', label: '成交' },
];

const INDUSTRY_OPTIONS = [
  '互联网',
  '贸易',
  '制造业',
  '金融',
  '教育',
  '医疗',
  '房地产',
  '物流',
  '其他',
];

/** 解析结构化备注 */
function parseStructuredNotes(notes: string | null) {
  const result = { legalRep: '', morePhones: [] as string[], emails: [] as string[], website: '', rawNotes: '' };
  if (!notes) return result;
  const lines = notes.split('\n');
  for (const line of lines) {
    let match = line.match(/^【(.+?)】(.*)$/);
    let key = '';
    let value = '';
    if (match) {
      key = match[1];
      value = match[2].trim();
    } else {
      match = line.match(/^([^：:]+)[：:](.*)$/);
      if (match) {
        key = match[1].trim();
        value = match[2].trim();
      }
    }
    if (key) {
      if (key === '法人' || key === '法定代表人') result.legalRep = value;
      else if (key === '更多电话' || key === '其他电话' || key === '备用电话') result.morePhones = value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
      else if (key === '邮箱' || key === '电子邮箱') result.emails = value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
      else if (key === '官网' || key === '官网网址' || key === '网站') result.website = value;
      else if (key === '备注' || key === '说明') result.rawNotes = value;
    } else if (line.trim()) {
      result.rawNotes = result.rawNotes ? `${result.rawNotes}\n${line}` : line;
    }
  }
  return result;
}

function MultiInput({
  label,
  values,
  onChange,
  placeholder,
  icon: Icon,
}: {
  label: string;
  values: string[];
  onChange: (vals: string[]) => void;
  placeholder: string;
  icon: React.ElementType;
}) {
  const add = () => onChange([...values, '']);
  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));
  const update = (idx: number, val: string) => {
    const next = [...values];
    next[idx] = val;
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        {label}
      </Label>
      <div className="space-y-2">
        {values.map((val, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              value={val}
              onChange={(e) => update(idx, e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
            {values.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(idx)}
                className="shrink-0 text-muted-foreground hover:text-red-500"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="w-full text-xs"
        >
          <Plus className="size-3 mr-1" />
          添加
        </Button>
      </div>
    </div>
  );
}

function CustomerFormDialog({
  open,
  onOpenChange,
  mode,
  customer,
  onSubmit,
  loading,
}: CustomerFormDialogProps) {
  const [company, setCompany] = useState('');
  const [legalRep, setLegalRep] = useState('');
  const [phones, setPhones] = useState<string[]>(['']);
  const [morePhones, setMorePhones] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [stage, setStage] = useState<CustomerStage>('UNCONTACTED');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && customer) {
        setCompany(customer.company);
        setIndustry(customer.industry || '');
        setStage(customer.stage);
        const parsed = parseStructuredNotes(customer.notes);
        setLegalRep(parsed.legalRep);
        // 主电话从contactInfo取，更多电话从notes取
        const primaryPhone = customer.contactInfo && customer.contactInfo !== '未提供' ? customer.contactInfo : '';
        setPhones(primaryPhone ? [primaryPhone] : ['']);
        setMorePhones(parsed.morePhones);
        setEmails(parsed.emails);
        setWebsite(parsed.website);
        setNotes(parsed.rawNotes);
      } else {
        setCompany('');
        setLegalRep('');
        setPhones(['']);
        setMorePhones([]);
        setEmails([]);
        setWebsite('');
        setIndustry('');
        setStage('UNCONTACTED');
        setNotes('');
      }
    }
  }, [open, mode, customer]);

  const handleSubmit = () => {
    if (!company.trim()) return;

    const cleanPhones = phones.map(p => p.trim()).filter(Boolean);
    const cleanMorePhones = morePhones.map(p => p.trim()).filter(Boolean);
    const cleanEmails = emails.map(e => e.trim()).filter(Boolean);

    const payload = {
      company: company.trim(),
      legalRep: legalRep.trim() || undefined,
      phones: cleanPhones.length > 0 ? cleanPhones : undefined,
      morePhones: cleanMorePhones.length > 0 ? cleanMorePhones : undefined,
      emails: cleanEmails.length > 0 ? cleanEmails : undefined,
      website: website.trim() || undefined,
      industry: industry || undefined,
      stage,
      notes: notes.trim() || undefined,
    };

    if (mode === 'create') {
      onSubmit(payload as CreateCustomerRequest);
    } else {
      onSubmit(payload as UpdateCustomerRequest);
    }
  };

  const isDisabled = !company.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'create' ? (
              <>
                <Plus className="size-5 text-primary" />
                新增客户
              </>
            ) : (
              <>
                <Edit3 className="size-5 text-primary" />
                编辑客户
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 公司名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="company" className="flex items-center gap-1.5">
              <Building2 className="size-3.5 text-muted-foreground" />
              公司名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="请输入公司名称"
            />
          </div>

          {/* 法人 */}
          <div className="space-y-1.5">
            <Label htmlFor="legalRep" className="flex items-center gap-1.5">
              <User className="size-3.5 text-muted-foreground" />
              法人
            </Label>
            <Input
              id="legalRep"
              value={legalRep}
              onChange={(e) => setLegalRep(e.target.value)}
              placeholder="可选，法定代表人姓名"
            />
          </div>

          {/* 有效电话（多值） */}
          <MultiInput
            label="有效电话"
            values={phones}
            onChange={setPhones}
            placeholder="手机号/座机号"
            icon={Phone}
          />

          {/* 更多电话（多值） */}
          {morePhones.length > 0 && (
            <MultiInput
              label="更多电话"
              values={morePhones}
              onChange={setMorePhones}
              placeholder="其他联系电话"
              icon={Phone}
            />
          )}
          {morePhones.length === 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMorePhones([''])}
              className="text-xs text-muted-foreground h-7"
            >
              <Plus className="size-3 mr-1" /> 添加更多电话
            </Button>
          )}

          {/* 邮箱（多值） */}
          {emails.length > 0 && (
            <MultiInput
              label="邮箱"
              values={emails}
              onChange={setEmails}
              placeholder="email@company.com"
              icon={Mail}
            />
          )}
          {emails.length === 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEmails([''])}
              className="text-xs text-muted-foreground h-7"
            >
              <Plus className="size-3 mr-1" /> 添加邮箱
            </Button>
          )}

          {/* 官网 */}
          <div className="space-y-1.5">
            <Label htmlFor="website" className="flex items-center gap-1.5">
              <Globe className="size-3.5 text-muted-foreground" />
              官网网址
            </Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.example.com"
            />
          </div>

          {/* 行业 + 阶段 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="industry">行业</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger id="industry" className="w-full">
                  <SelectValue placeholder="请选择行业" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage">客户阶段</Label>
              <Select
                value={stage}
                onValueChange={(val) => setStage(val as CustomerStage)}
              >
                <SelectTrigger id="stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 备注 */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="可选，填写客户相关备注信息..."
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isDisabled || loading}>
            {loading ? '保存中...' : mode === 'create' ? '创建' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { CustomerFormDialog, STAGE_OPTIONS, INDUSTRY_OPTIONS };
