import { InputHTMLAttributes, forwardRef } from 'react';
import Icon, { IconType } from '@/components/ui/Icon';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  containerClassName?: string;
  inline?: 'sm' | 'lg';
  icon?: IconType;
  showClear?: boolean;
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, helpText, containerClassName, inline, icon, showClear, value, onChange, className, ...props }, ref) => {
    const baseInputClasses = "ds-input px-5 py-3.5 placeholder:text-[#1a1a1a]/40 focus-visible:outline-none disabled:bg-white/35 disabled:text-[#1a1a1a]/50";
    const errorClasses = error ? "bg-[rgba(224,85,102,0.12)] border-[rgba(224,85,102,0.45)] focus-visible:shadow-[0_0_0_3px_rgba(224,85,102,0.2)]" : "";
    const iconPaddingClasses = icon ? "pl-10" : ""; // Add left padding when icon is present
    
    // Determine width classes based on inline prop
    let widthClasses = "w-full";
    if (inline === 'sm') {
      widthClasses = "w-20";
    }
    
    const combinedClasses = `${baseInputClasses} ${widthClasses} ${errorClasses} ${iconPaddingClasses} ${className || ''}`.trim();

    if (inline && label) {
      return (
        <div className={`space-y-2 ${containerClassName || ''}`}>
          <div className="flex items-center space-x-3 justify-between">
            <label htmlFor={props.id} className="text-sm font-semibold text-[#1a1a1a] whitespace-nowrap">
              {label}
            </label>
            <div className="relative">
              {icon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon type={icon} size="sm" className="text-[#1a1a1a]/45" />
                </div>
              )}
              <input
                ref={ref}
                className={combinedClasses}
                {...props}
              />
              {showClear && value && onChange && (
                  <button
                      onClick={() => {
                        const event = { target: { value: '' } } as React.ChangeEvent<HTMLInputElement>;
                        onChange(event);
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#1a1a1a]/45 hover:text-[#1a1a1a]/70"
                      type="button"
                  >
                      <Icon type="x" size="sm" />
                  </button>
              )}
            </div>
          </div>
          {helpText && !error && (
            <p className="text-sm text-[#1a1a1a]/58">{helpText}</p>
          )}
          {error && (
            <p className="text-sm text-[#932231]">{error}</p>
          )}
        </div>
      );
    }

    return (
      <div className={`space-y-2 ${containerClassName || ''}`}>
        {label && (
          <label htmlFor={props.id} className="block text-sm font-semibold text-[#1a1a1a]">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon type={icon} size="sm" className="text-[#1a1a1a]/45" />
            </div>
          )}
          <input
            ref={ref}
            className={combinedClasses}
            value={value}
            onChange={onChange}
            {...props}
          />
          {showClear && value && onChange && (
            <button
              onClick={() => {
                const event = { target: { value: '' } } as React.ChangeEvent<HTMLInputElement>;
                onChange(event);
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#1a1a1a]/45 hover:text-[#1a1a1a]/70"
              type="button"
            >
              <Icon type="x" size="sm" />
            </button>
          )}
        </div>
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

FormInput.displayName = 'FormInput';
export default FormInput;
