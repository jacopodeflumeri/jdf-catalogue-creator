import FormInput from './form/FormInput';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function SearchInput({
    value,
    onChange,
    placeholder = "Search...",
    className = ""
}: SearchInputProps) {
    return (
        <div className={`space-y-6 mb-6 p-6 glass-card ${className}`}>
            <div className="flex gap-4">
            <FormInput
                id="search"
                type="text"
                placeholder={placeholder}
                value={value}
                icon="search"
                showClear={true}
                onChange={(e) => onChange(e.target.value)}
            />
            </div>
        </div>
    );
}
