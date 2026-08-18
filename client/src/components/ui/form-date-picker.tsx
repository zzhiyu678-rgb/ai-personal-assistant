import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import { Calendar } from '@client/src/components/ui/calendar';
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from '@client/src/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { cn } from '@/lib/utils';

interface FormDatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function FormDatePicker({
  label,
  value,
  onChange,
  placeholder = '选择日期',
  disabled = false,
}: FormDatePickerProps) {
  const selectedDate = value ? new Date(value) : undefined;

  return (
    <FormItem className="flex flex-col">
      <FormLabel>{label}</FormLabel>
      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              className={cn(
                'w-full pl-3 text-left font-normal',
                !value && 'text-muted-foreground',
              )}
              disabled={disabled}
            >
              {value ? (
                format(selectedDate as Date, 'yyyy-MM-dd')
              ) : (
                <span>{placeholder}</span>
              )}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date: Date | undefined) => {
              if (date) {
                onChange(format(date, 'yyyy-MM-dd'));
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
}

export default FormDatePicker;
