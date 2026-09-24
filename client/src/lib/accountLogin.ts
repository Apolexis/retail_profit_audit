import { formatRussianPhone } from "./phone";

/** Phone accounts stay masked/formatted; store accounts retain their issued login. */
export const formatLocalAccountLogin = (value: string) => /^79\d{9}$/.test(value.replace(/\D/g, "")) ? formatRussianPhone(value) : value;
