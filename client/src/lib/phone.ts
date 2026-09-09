export const normalizeRussianPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const subscriber = digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits;
  return `7${subscriber.slice(0, 10)}`;
};

export const formatRussianPhone = (value: string) => {
  const normalized = normalizeRussianPhone(value);
  if (!normalized) return "";
  const rest = normalized.slice(1);
  return `+7${rest.length ? ` (${rest.slice(0, 3)}` : ""}${rest.length >= 3 ? ") " : ""}${rest.slice(3, 6)}${rest.length >= 6 ? "-" : ""}${rest.slice(6, 8)}${rest.length >= 8 ? "-" : ""}${rest.slice(8, 10)}`;
};

/** Removes a subscriber digit targeted by Backspace/Delete in a formatted +7 field. */
export const removePhoneDigitAtCursor=(value:string,display:string,start:number,end:number,direction:"backspace"|"delete")=>{const normalized=normalizeRussianPhone(value);const rest=normalized.slice(1);if(!rest)return "";const entries=Array.from(display).flatMap((symbol,position)=>/\d/.test(symbol)&&position!==1?[{position,index:rest.length?Array.from(display.slice(0,position)).filter(char=>/\d/.test(char)&&char!==display[1]).length:0}]:[]);const inSelection=entries.filter(entry=>entry.position>=start&&entry.position<end);const target=inSelection.length?inSelection:direction==="backspace"?[...entries].reverse().filter(entry=>entry.position<start).slice(0,1):entries.filter(entry=>entry.position>=start).slice(0,1);if(!target.length)return normalized;const removeIndexes=new Set(target.map(entry=>entry.index));const next=rest.split("").filter((_,index)=>!removeIndexes.has(index)).join("");return next?`7${next}`:"";};
