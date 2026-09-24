import * as React from "react";
import { FreeScrollSelect } from "@/components/FreeScrollSelect";
import { cn } from "@/lib/utils";

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
    if (child.type === React.Fragment) {
      const props = child.props as { children?: React.ReactNode };
      options.push(...collectOptions(props.children, group));
      return;
    }
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
 * но отображается тем же тематичным немодальным списком, что и прайс‑контроль.
 */
type ThemedSelectProps = React.ComponentProps<"select"> & {
  searchable?: boolean;
  searchPlaceholder?: string;
};

function ThemedSelect({
  children,
  className,
  value,
  defaultValue,
  onChange,
  disabled,
  searchable = false,
  searchPlaceholder,
  ...props
}: ThemedSelectProps) {
  const options = React.useMemo(() => collectOptions(children), [children]);
  const rawValue = value ?? defaultValue ?? "";
  const normalizedValue = rawValue === "" ? EMPTY_VALUE : String(rawValue);
  const placeholder =
    options.find(option => option.value === EMPTY_VALUE)?.label ?? "Выберите значение";

  return (
    <FreeScrollSelect
      value={normalizedValue}
      onValueChange={nextValue => {
        const next = nextValue === EMPTY_VALUE ? "" : nextValue;
        onChange?.({ target: { value: next }, currentTarget: { value: next } } as React.ChangeEvent<HTMLSelectElement>);
      }}
      disabled={disabled}
      className={cn("app-select-trigger", className)}
      contentClassName="app-select-content"
      ariaLabel={props["aria-label"]}
      ariaDescribedBy={props["aria-describedby"]}
      ariaInvalid={props["aria-invalid"]}
      placeholder={placeholder}
      options={options}
      searchable={Boolean(searchable && options.length > 10)}
      searchPlaceholder={searchPlaceholder}
    />
  );
}

export { ThemedSelect };
