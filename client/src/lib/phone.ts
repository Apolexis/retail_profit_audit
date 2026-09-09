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
export const removePhoneDigitAtCursor=(value:string,display:string,start:number,end:number,direction:"backspace"|"delete")=>{const normalized=normalizeRussianPhone(value);const rest=normalized.slice(1);if(!rest)return "";let subscriberIndex=0;const entries=Array.from(display).flatMap((symbol,position)=>{if(!/\d/.test(symbol)||position===1)return[];const entry={position,index:subscriberIndex};subscriberIndex+=1;return[entry]});const inSelection=entries.filter(entry=>entry.position>=start&&entry.position<end);const onSeparator=start===end&&!/\d/.test(display[start]??"");const target=inSelection.length?inSelection:onSeparator&&direction==="backspace"?entries.filter(entry=>entry.position>start).slice(0,1):onSeparator&&direction==="delete"?[...entries].reverse().filter(entry=>entry.position<start).slice(0,1):direction==="backspace"?[...entries].reverse().filter(entry=>entry.position<start).slice(0,1):entries.filter(entry=>entry.position>=start).slice(0,1);if(!target.length)return normalized;const removeIndex=target[0].index;const next=rest.slice(0,removeIndex)+rest.slice(removeIndex+1);return next?`7${next}`:"";};
