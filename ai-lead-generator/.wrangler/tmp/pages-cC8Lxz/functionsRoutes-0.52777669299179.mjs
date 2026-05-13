import { onRequest as __api___route___ts_onRequest } from "D:\\claude\\ai-team\\output\\ai-lead-generator\\functions\\api\\[[route]].ts"

export const routes = [
    {
      routePath: "/api/:route*",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api___route___ts_onRequest],
    },
  ]