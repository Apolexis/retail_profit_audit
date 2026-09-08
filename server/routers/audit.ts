import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { commitWorkbook, getAuditDashboard, listAuditStores, listStoreMetrics, previewWorkbook, setStoreVisibility, updateMetricValue } from "../audit";
const upload=z.object({fileName:z.string().min(1).max(255),fileBase64:z.string().min(20)});
export const auditRouter=router({
  stores:protectedProcedure.query(()=>listAuditStores()),
  dashboard:publicProcedure.query(()=>getAuditDashboard()),
  previewImport:protectedProcedure.input(upload).mutation(async({input})=>previewWorkbook(Buffer.from(input.fileBase64,"base64"),input.fileName)),
  commitImport:protectedProcedure.input(upload.extend({resolution:z.enum(["replace","skip"])})).mutation(async({input})=>commitWorkbook(Buffer.from(input.fileBase64,"base64"),input.fileName,input.resolution)),
  setVisibility:protectedProcedure.input(z.object({id:z.number().int(),isHidden:z.boolean()})).mutation(({input})=>setStoreVisibility(input.id,input.isHidden)),
  metrics:protectedProcedure.input(z.object({storeId:z.number().int(),monthDate:z.string().regex(/^20\d{2}-\d{2}$/)})).query(({input})=>listStoreMetrics(input.storeId,input.monthDate)),
  updateMetric:protectedProcedure.input(z.object({storeId:z.number().int(),monthDate:z.string().regex(/^20\d{2}-\d{2}$/),metricCode:z.string().min(1),amount:z.number()})).mutation(({input})=>updateMetricValue(input.storeId,input.monthDate,input.metricCode,input.amount)),
});
