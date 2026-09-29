export type OrderSyncExecution = () => Promise<
  { status: 'succeeded'; factsWritten: number } | { status: 'failed' }
>

type Dependencies = {
  schedulerKey: () => string | undefined
  runSync: OrderSyncExecution
  now?: () => number
}

export function createOrderSyncRequestHandler(dependencies: Dependencies) {
  const now = dependencies.now ?? Date.now

  return async (request: Request): Promise<Response> => {
    const schedulerKey = dependencies.schedulerKey()
    if (!schedulerKey || request.headers.get('apikey') !== schedulerKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startedAt = now()
    let result: Awaited<ReturnType<OrderSyncExecution>>
    try {
      result = await dependencies.runSync()
    } catch {
      return Response.json({ source: 'ordersync', status: 'failed' }, { status: 502 })
    }

    if (result.status === 'failed') {
      return Response.json({ source: 'ordersync', status: 'failed' }, { status: 502 })
    }

    return Response.json({
      source: 'ordersync',
      status: 'succeeded',
      factsWritten: result.factsWritten,
      durationMs: now() - startedAt,
    })
  }
}
