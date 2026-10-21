import { InputHTMLAttributes } from 'react';

interface ToggleProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'size'> {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  variant?: 'checkbox' | 'toggle';
  colorVariant?: 'primary' | 'yellow' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  containerClassName?: string;
  labelClassName?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({
  label,
  checked,
  onChange,
  variant = 'toggle',
  colorVariant = 'primary',
  size = 'md',
  containerClassName,
  labelClassName,
  description,
  error,
  disabled = false,
  id,
  ...props
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.checked);
  };

  const colorClasses = {
    primary: {
      checkbox:
        'accent-primary text-primary focus-visible:shadow-[0_0_0_3px_rgba(141,119,247,0.2)]',
      toggle: 'bg-primary',
    },
    warning: {
      checkbox:
        'accent-[#E05566] text-[#E05566] focus-visible:shadow-[0_0_0_3px_rgba(224,85,102,0.2)]',
      toggle: 'bg-[#E05566]',
    },
    yellow: {
      checkbox:
        'accent-[#D8A24A] text-[#D8A24A] focus-visible:shadow-[0_0_0_3px_rgba(216,162,74,0.2)]',
      toggle: 'bg-[#D8A24A]',
    },
  };

  const sizeClasses = {
    checkbox: {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    },
    toggle: {
      sm: 'h-5 w-9',
      md: 'h-6 w-11',
      lg: 'h-7 w-12',
    },
  };

  const knobSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const translateClasses = {
    sm: checked ? 'translate-x-4' : 'translate-x-0',
    md: checked ? 'translate-x-5' : 'translate-x-0',
    lg: checked ? 'translate-x-5' : 'translate-x-0',
  };

  if (variant === 'checkbox') {
    return (
      <div className={`space-y-2 ${containerClassName || ''}`}>
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            className={`${sizeClasses.checkbox[size]} ${colorClasses[colorVariant].checkbox} border border-white/75 bg-white/70 rounded-md transition-all duration-300 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${error ? 'border-[#E05566]' : ''}`}
            {...props}
          />
          {label && (
            <label
              htmlFor={id}
              className={`${labelClassName || ''} text-sm font-medium ${disabled ? 'text-[#1a1a1a]/45 cursor-not-allowed' : 'text-[#1a1a1a]/80 cursor-pointer'}`}
            >
              {label}
            </label>
          )}
        </div>

        {description && <p className="text-sm text-[#1a1a1a]/58 ml-6">{description}</p>}
        {error && <p className="text-sm text-[#932231] ml-6">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${containerClassName || ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {label && (
            <label
              htmlFor={id}
              className={`${labelClassName || ''} block text-sm font-medium ${disabled ? 'text-[#1a1a1a]/45' : 'text-[#1a1a1a]/80'}`}
            >
              {label}
            </label>
          )}
          {description && <p className="text-sm text-[#1a1a1a]/58">{description}</p>}
        </div>

        <div className="flex items-center">
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`${sizeClasses.toggle[size]} relative inline-flex items-center rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(141,119,247,0.2)] p-0.5 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${checked ? (error ? 'bg-[#E05566]' : colorClasses[colorVariant].toggle) : 'bg-white/70 border border-white/70'}`}
          >
            <span
              className={`${knobSizeClasses[size]} inline-block rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.18)] transform transition-transform duration-300 ${translateClasses[size]}`}
            />
          </button>

          <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            className="sr-only"
            {...props}
          />
        </div>
      </div>

      {error && <p className="text-sm text-[#932231]">{error}</p>}
    </div>
  );
};

export default Toggle;
