import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { commitWorkbook, getAuditDashboard, listAuditStores, listStoreMetrics, previewWorkbook, setStoreVisibility, updateMetricValue } from "../audit";
import { listChanges, recordChange, rollbackMetricChange } from "../localAuth";
const upload=z.object({fileName:z.string().min(1).max(255),fileBase64:z.string().min(20)});
export const auditRouter=router({
  stores:protectedProcedure.query(()=>listAuditStores()),
  dashboard:protectedProcedure.query(()=>getAuditDashboard()),
  previewImport:protectedProcedure.input(upload).mutation(async({input})=>previewWorkbook(Buffer.from(input.fileBase64,"base64"),input.fileName)),
  commitImport:protectedProcedure.input(upload.extend({resolution:z.enum(["replace","skip"])})).mutation(async({input,ctx})=>{const result=await commitWorkbook(Buffer.from(input.fileBase64,"base64"),input.fileName,input.resolution);await recordChange({actorId:ctx.user.id,action:"import.commit",entityType:"import",entityId:input.fileName,afterState:{resolution:input.resolution,...result}});return result}),
  setVisibility:protectedProcedure.input(z.object({id:z.number().int(),isHidden:z.boolean()})).mutation(async({input,ctx})=>{const before=(await listAuditStores()).find(store=>store.id===input.id);const result=await setStoreVisibility(input.id,input.isHidden);await recordChange({actorId:ctx.user.id,action:"store.visibility",entityType:"store",entityId:String(input.id),beforeState:before?{isHidden:before.isHidden}:null,afterState:{isHidden:input.isHidden}});return result}),
  metrics:protectedProcedure.input(z.object({storeId:z.number().int(),monthDate:z.string().regex(/^20\d{2}-\d{2}$/)})).query(({input})=>listStoreMetrics(input.storeId,input.monthDate)),
  updateMetric:protectedProcedure.input(z.object({storeId:z.number().int(),monthDate:z.string().regex(/^20\d{2}-\d{2}$/),metricCode:z.string().min(1),amount:z.number()})).mutation(async({input,ctx})=>{const previous=(await listStoreMetrics(input.storeId,input.monthDate)).find(metric=>metric.metricCode===input.metricCode);const before={...input,amount:Number(previous?.amount??0)};const result=await updateMetricValue(input.storeId,input.monthDate,input.metricCode,input.amount);await recordChange({actorId:ctx.user.id,action:"metric.update",entityType:"metric",entityId:`${input.storeId}:${input.monthDate}:${input.metricCode}`,beforeState:before,afterState:input});return result}),
  changes:adminProcedure.query(()=>listChanges()),
  rollbackChange:adminProcedure.input(z.object({changeId:z.number().int()})).mutation(({input,ctx})=>rollbackMetricChange(input.changeId,ctx.user.id)),
});
