export const name = 'dsh-claude-video-slider';

const ULTRA_PROMPT = `这是一场验证模型全部能力的高压测试。务必调动你的全部能力，优先保证任务完成度、正确性和验证质量。可以充分使用现有 token 与工具预算；不要为了节约 token 省略必要的调研、分析、实现或验证。

遇到复杂任务时，主动把可独立进行的工作并行委派给可用的子代理，例如分别分析原因、评估方案和复核关键结论。给每个子代理明确的目标、范围、所需证据和交付物，主代理继续推进不依赖这些结果的工作，并核对和整合结论。简单任务直接完成，避免重复委派。

在用户授权和宿主权限范围内，持续推进到交付或确实受阻。围绕目标使用资源，完成后停止，并报告已验证的结果及仍有的限制。`;

export function apply(ctx) {
  ctx.inject(['connection', 'systemPrompt', 'sessionController'], scope => {
    if (typeof scope.connection.fetch?.register !== 'function' || typeof scope.systemPrompt.context !== 'function') return;
    const active = new Map();

    scope.connection.fetch.register({
      path: '/api/dsh-claude-video-slider/ultra',
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        const payload = await request.json().catch(() => null);
        const { sessionId, enabled, selection } = payload ?? {};
        if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 256) {
          return Response.json({ error: '会话标识无效。' }, { status: 400 });
        }
        if (enabled === undefined) return Response.json({ active: active.has(sessionId) });
        if (typeof enabled !== 'boolean' || typeof selection?.provider !== 'string' || !selection.provider
          || typeof selection.model !== 'string' || !selection.model
          || (selection.reasoningEffort !== undefined && typeof selection.reasoningEffort !== 'string')
          || (enabled && (selection.reasoningEffort !== 'max' || !/(?:^|\/)deepseek[-_]/i.test(selection.model)))) {
          return Response.json({ error: 'Ultra 需要支持 Max 的 DeepSeek 模型。' }, { status: 400 });
        }
        try {
          const { provider, model, reasoningEffort } = selection;
          const { selected } = await scope.sessionController.selectModel({
            sessionId, provider, model, ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
          });
          if (enabled) active.set(sessionId, selected);
          else active.delete(sessionId);
          return Response.json({ active: enabled });
        } catch (error) {
          return Response.json({ error: error?.message || '未能保存推理等级。' }, { status: 409 });
        }
      },
    });

    scope.on('session/event', (session, event) => {
      if (event.type === 'model/selection') active.delete(session.id);
    });
    scope.on('agent/disposed', ({ agent }) => active.delete(agent.id));
    scope.systemPrompt.context({
      name: 'dsh-claude-video-slider:ultra',
      order: 100,
      required: true,
      text({ agent, modelSelection }) {
        const selection = active.get(agent?.id);
        return selection && modelSelection?.provider === selection.provider && modelSelection?.model === selection.model
          && modelSelection.reasoningEffort === 'max' ? ULTRA_PROMPT : '';
      },
    });
  });
}
