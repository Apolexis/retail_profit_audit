import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_VALUE = "__app_select_empty__";

type Option = {
  value: string;
  label: string;
  disabled: boolean;
  group: string | null;
};

function labelFromNode(node: React.ReactNode): string {
  return React.Children.toArray(node)
    .map(child => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("")
    .trim();
}

function collectOptions(
  children: React.ReactNode,
  group: string | null = null
): Option[] {
  const options: Option[] = [];
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return;
    if (child.type === "option") {
      const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
      options.push({
        value: props.value == null || props.value === "" ? EMPTY_VALUE : String(props.value),
        label: labelFromNode(props.children),
        disabled: Boolean(props.disabled),
        group,
      });
      return;
    }
    if (child.type === "optgroup") {
      const props = child.props as React.OptgroupHTMLAttributes<HTMLOptGroupElement>;
      options.push(...collectOptions(props.children, props.label ?? null));
    }
  });
  return options;
}

/**
 * Совместимая замена native select: принимает option/optgroup и onChange,
 * но отображается тем же тематичным портальным списком, что и прайс‑контроль.
 */
function ThemedSelect({
  children,
  className,
  value,
  defaultValue,
  onChange,
  disabled,
  ...props
}: React.ComponentProps<"select">) {
  const options = React.useMemo(() => collectOptions(children), [children]);
  const rawValue = value ?? defaultValue ?? "";
  const normalizedValue = rawValue === "" ? EMPTY_VALUE : String(rawValue);
  const placeholder =
    options.find(option => option.value === EMPTY_VALUE)?.label ?? "Выберите значение";

  return (
    <Select
      value={normalizedValue}
      onValueChange={nextValue => {
        const next = nextValue === EMPTY_VALUE ? "" : nextValue;
        onChange?.({ target: { value: next }, currentTarget: { value: next } } as React.ChangeEvent<HTMLSelectElement>);
      }}
      disabled={disabled}
      name={props.name}
    >
      <SelectTrigger
        className={cn("app-select-trigger", className)}
        aria-label={props["aria-label"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="app-select-content" align="start">
        {options.map((option, index) => (
          <React.Fragment key={`${option.group ?? "base"}-${option.value}-${index}`}>
            {option.group &&
              (index === 0 || options[index - 1]?.group !== option.group) && (
                <SelectLabel>{option.group}</SelectLabel>
              )}
            <SelectItem value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}

export { ThemedSelect };
