import { InputHTMLAttributes, forwardRef } from 'react';

interface FormCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helpText?: string;
  containerClassName?: string;
}

const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(
  ({ label, error, helpText, containerClassName, className, ...props }, ref) => {
    const baseCheckboxClasses = "h-4 w-4 accent-primary text-primary focus-visible:shadow-[0_0_0_3px_rgba(141,119,247,0.2)] border border-white/75 bg-white/70 rounded";
    const errorClasses = error ? "border-[#E05566] focus-visible:shadow-[0_0_0_3px_rgba(224,85,102,0.2)]" : "";
    const combinedClasses = `${baseCheckboxClasses} ${errorClasses} ${className || ''}`.trim();

    return (
      <div className={`space-y-2 ${containerClassName || ''}`}>
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              ref={ref}
              type="checkbox"
              className={combinedClasses}
              {...props}
            />
          </div>
          {label && (
            <div className="ml-3 text-sm">
              <label htmlFor={props.id} className="font-semibold text-[#1a1a1a]">
                {label}
              </label>
            </div>
          )}
        </div>
        {helpText && !error && (
          <p className="ml-7 text-sm text-[#1a1a1a]/58">{helpText}</p>
        )}
        {error && (
          <p className="ml-7 text-sm text-[#932231]">{error}</p>
        )}
      </div>
    );
  }
);

FormCheckbox.displayName = 'FormCheckbox';
export default FormCheckbox;
