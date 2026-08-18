import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@client/src/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import type {
  Goal,
  GoalType,
  GoalStatus,
  CreateGoalRequest,
  UpdateGoalRequest,
} from '@shared/api.interface';
import FormDatePicker from '@client/src/components/ui/form-date-picker';

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGoal?: Goal | null;
  parentOptions: { id: string; title: string }[];
  defaultType?: GoalType;
  onSubmit: (data: CreateGoalRequest | UpdateGoalRequest) => Promise<void>;
  submitting?: boolean;
}

const formSchema = z
  .object({
    title: z.string().min(1, '请输入目标名称'),
    description: z.string().default(''),
    type: z.enum(['YEAR', 'MONTH', 'WEEK']),
    startDate: z.string().min(1, '请选择开始日期'),
    endDate: z.string().min(1, '请选择结束日期'),
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE']),
    parentId: z.string().optional(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: '开始日期不能晚于结束日期',
    path: ['endDate'],
  });

function GoalFormDialog({
  open,
  onOpenChange,
  editingGoal,
  parentOptions,
  defaultType = 'MONTH',
  onSubmit,
  submitting = false,
}: GoalFormDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      type: defaultType,
      startDate: '',
      endDate: '',
      status: 'NOT_STARTED',
      parentId: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editingGoal) {
        form.reset({
          title: editingGoal.title,
          description: editingGoal.description,
          type: editingGoal.type,
          startDate: editingGoal.startDate,
          endDate: editingGoal.endDate,
          status: editingGoal.status,
          parentId: editingGoal.parentId ?? '',
        });
      } else {
        form.reset({
          title: '',
          description: '',
          type: defaultType,
          startDate: '',
          endDate: '',
          status: 'NOT_STARTED',
          parentId: '',
        });
      }
    }
  }, [open, editingGoal, defaultType, form]);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    const payload: CreateGoalRequest | UpdateGoalRequest = {
      ...values,
      parentId: values.parentId || undefined,
    };
    await onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingGoal ? '编辑目标' : '新建目标'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目标名称</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入目标名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入目标描述"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>类型</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="YEAR">年度</SelectItem>
                        <SelectItem value="MONTH">月度</SelectItem>
                        <SelectItem value="WEEK">周</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>状态</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NOT_STARTED">未开始</SelectItem>
                        <SelectItem value="IN_PROGRESS">进行中</SelectItem>
                        <SelectItem value="DONE">已完成</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormDatePicker
                    label="开始日期"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="选择开始日期"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormDatePicker
                    label="结束日期"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="选择结束日期"
                  />
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>上级目标（可选）</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择上级目标" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">无</SelectItem>
                      {parentOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '保存中...' : editingGoal ? '保存' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default GoalFormDialog;
export type { GoalStatus };
