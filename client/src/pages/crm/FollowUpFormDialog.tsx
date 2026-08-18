import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';

import type { CreateFollowUpRequest, FollowUpType } from '@shared/api.interface';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Textarea } from '@client/src/components/ui/textarea';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';

interface FollowUpFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateFollowUpRequest) => void;
  loading: boolean;
}

const FOLLOW_TYPE_OPTIONS: Array<{ value: FollowUpType; label: string }> = [
  { value: 'PHONE', label: '电话' },
  { value: 'WECHAT', label: '微信' },
  { value: 'MEETING', label: '会面' },
  { value: 'EMAIL', label: '邮件' },
  { value: 'OTHER', label: '其他' },
];

function FollowUpFormDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: FollowUpFormDialogProps) {
  const [content, setContent] = useState('');
  const [followType, setFollowType] = useState<FollowUpType>('PHONE');

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit({ content: content.trim(), followType });
    setContent('');
    setFollowType('PHONE');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="size-5 text-primary" />
            添加跟进记录
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="followType">跟进类型</Label>
            <Select
              value={followType}
              onValueChange={(val) => setFollowType(val as FollowUpType)}
            >
              <SelectTrigger id="followType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLLOW_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content">
              跟进内容 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="请详细描述本次跟进的内容、客户反馈和关键信息..."
              className="min-h-[140px]"
            />
            <p className="text-xs text-muted-foreground">
              保存后可在客户详情页点击「AI分析」获取客户意向分析
            </p>
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
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
          >
            {loading ? '保存中...' : '保存跟进记录'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { FollowUpFormDialog };
