import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

type PasswordInputProps = Omit<ComponentProps<"input">, "type">;

/** Password entry with a local visibility toggle; the value never leaves the input through this control. */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Скрыть пароль" : "Показать пароль";

  return (
    <span className="password-input">
      <input {...props} className={className} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-input-toggle"
        aria-label={label}
        aria-pressed={visible}
        title={label}
        onClick={() => setVisible(current => !current)}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </span>
  );
}
