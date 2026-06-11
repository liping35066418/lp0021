import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FormItemProps {
  label: string;
  name?: string;
  children: ReactNode;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  labelClassName?: string;
}

export default function FormItem({
  label,
  name,
  children,
  error,
  required,
  hint,
  className,
  labelClassName,
}: FormItemProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={name}
        className={cn(
          'block text-sm font-medium text-gray-700',
          labelClassName
        )}
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-sm text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors',
        error
          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 placeholder-gray-400',
        className
      )}
      {...props}
    />
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function TextArea({ className, error, ...props }: TextAreaProps) {
  return (
    <textarea
      className={cn(
        'w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none',
        error
          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 placeholder-gray-400',
        className
      )}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options: { value: string; label: string }[];
}

export function Select({ className, error, options, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full px-3 py-2 text-sm border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white',
        error
          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300',
        className
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {children}
    </select>
  );
}
