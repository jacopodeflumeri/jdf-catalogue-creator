import { TextareaHTMLAttributes, forwardRef } from 'react';

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
  containerClassName?: string;
}

const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, helpText, containerClassName, className, ...props }, ref) => {
    const baseTextareaClasses = "ds-input px-5 py-3.5 placeholder:text-[#1a1a1a]/40 focus-visible:outline-none disabled:bg-white/35 disabled:text-[#1a1a1a]/50 resize-vertical";
    const errorClasses = error ? "bg-[rgba(224,85,102,0.12)] border-[rgba(224,85,102,0.45)] focus-visible:shadow-[0_0_0_3px_rgba(224,85,102,0.2)]" : "";
    const combinedClasses = `${baseTextareaClasses} ${errorClasses} ${className || ''}`.trim();

    return (
      <div className={`space-y-2 ${containerClassName || ''}`}>
        {label && (
          <label htmlFor={props.id} className="block text-sm font-semibold text-[#1a1a1a]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={combinedClasses}
          {...props}
        />
        {helpText && !error && (
          <p className="mt-1 text-xs text-[#1a1a1a]/58">{helpText}</p>
        )}
        {error && (
          <p className="text-sm text-[#932231]">{error}</p>
        )}
      </div>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';
export default FormTextarea;
