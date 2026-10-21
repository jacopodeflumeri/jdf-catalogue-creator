import { SelectHTMLAttributes, forwardRef } from 'react';

type SelectOption = { value: string; label: string; disabled?: boolean };
type SelectGroup = { label: string; options: SelectOption[] };

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
  containerClassName?: string;
  options: SelectOption[] | (SelectOption | SelectGroup)[];
  placeholder?: string;
}

// Type guard to check if an item is a group
const isGroup = (item: SelectOption | SelectGroup): item is SelectGroup => {
  return 'options' in item;
};

// Type guard to check if all options are simple SelectOptions
const isAllSimpleOptions = (options: SelectOption[] | (SelectOption | SelectGroup)[]): options is SelectOption[] => {
  return options.every(item => !isGroup(item));
};

const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, helpText, containerClassName, className, options, placeholder, ...props }, ref) => {
    const baseSelectClasses = "ds-input px-5 py-3.5 placeholder:text-[#1a1a1a]/40 focus-visible:outline-none disabled:bg-white/35 disabled:text-[#1a1a1a]/50";
    const errorClasses = error ? "bg-[rgba(224,85,102,0.12)] border-[rgba(224,85,102,0.45)] focus-visible:shadow-[0_0_0_3px_rgba(224,85,102,0.2)]" : "";
    const combinedClasses = `${baseSelectClasses} ${errorClasses} ${className || ''}`.trim();

    const renderOptions = () => {
      if (isAllSimpleOptions(options)) {
        // All options are simple SelectOption
        return options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ));
      } else {
        // Mixed options (SelectOption and SelectGroup)
        return options.map((item) => {
          if (isGroup(item)) {
            // Render group
            return (
              <optgroup key={item.label} label={item.label}>
                {item.options.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            );
          } else {
            // Render simple option
            return (
              <option key={item.value} value={item.value} disabled={item.disabled}>
                {item.label}
              </option>
            );
          }
        });
      }
    };

    return (
      <div className={`space-y-2 ${containerClassName || ''}`}>
        {label && (
          <label htmlFor={props.id} className="block text-sm font-semibold text-[#1a1a1a]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={combinedClasses}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {renderOptions()}
        </select>
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

FormSelect.displayName = 'FormSelect';
export default FormSelect;
