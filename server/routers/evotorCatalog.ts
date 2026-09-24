import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getOperationalEvotorMapping, listEvotorCatalogPreviewForOperationalStore, listEvotorDocumentsPreviewForOperationalStore } from "../evotorCatalog";

export const evotorCatalogRouter = router({
  mappingForStore: adminProcedure.input(z.object({ storeId: z.number().int().positive() })).query(async ({ input }) => getOperationalEvotorMapping(input.storeId)),
  previewForStore: adminProcedure.input(z.object({ storeId: z.number().int().positive() })).query(async ({ input }) => listEvotorCatalogPreviewForOperationalStore(input.storeId)),
  documentsPreviewForStore: adminProcedure.input(z.object({ storeId: z.number().int().positive(), cursor: z.string().min(1).max(512).optional() })).query(async ({ input }) => listEvotorDocumentsPreviewForOperationalStore(input)),
});
