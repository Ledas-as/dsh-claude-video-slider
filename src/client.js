// DSH's shared model directory remains authoritative. Only its model seat is replaced.
// Slot/directory integration follows the upstream DSH and MEMZ-JZY plugin patterns.
const h = React.createElement;

function AnimatedLabel({ text, order = 0 }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => { ref.current.setLabel(text, order); }, [text, order]);
  return h('dsh-claude-slider-label', { ref });
}

function EffortSlider({ steps, value, recommended, defaultActive, disabled, saving, onChange }) {
  const ref = React.useRef(null);
  const changeRef = React.useRef(onChange);
  changeRef.current = onChange;
  React.useLayoutEffect(() => {
    const element = ref.current;
    element.steps = steps;
    element.recommended = recommended;
  }, [steps, recommended]);
  React.useLayoutEffect(() => {
    if (saving) return;
    const element = ref.current;
    element.value = value;
    element.defaultActive = defaultActive;
  }, [value, defaultActive, saving]);
  React.useLayoutEffect(() => {
    const element = ref.current;
    element.toggleAttribute('saving', saving);
    element.disabled = disabled;
  }, [saving, disabled]);
  React.useEffect(() => {
    const element = ref.current;
    const change = event => changeRef.current(event.detail.index);
    element.addEventListener('change', change);
    return () => element.removeEventListener('change', change);
  }, []);
  return h('dsh-claude-effort-slider', { ref, inline: '' });
}

function ModelControl({ available, locked, directory, load, select }) {
  const subscribe = React.useCallback(listener => directory.subscribe(listener), [directory]);
  const snapshot = React.useCallback(() => directory.getSnapshot(), [directory]);
  const state = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  const [pane, setPane] = React.useState(null);
  const [error, setError] = React.useState('');
  const root = React.useRef(null);
  const popup = React.useRef(null);
  const trigger = React.useRef(null);
  const id = React.useId();
  const operation = React.useRef(0);
  const submitting = React.useRef(false);
  const [saving, setSaving] = React.useState(false);
  const choices = React.useMemo(() => (state.groups || []).flatMap(group => group.models.map(model => ({ group, model }))), [state.groups]);
  const selected = state.pending || state.current;
  const choice = choices.find(item => item.group.id === selected?.provider && item.model.id === selected?.model);
  const reasoning = choice?.model.reasoning;
  const steps = React.useMemo(() => (reasoning?.efforts || []).map(effort => ({ id: effort.id, label: effort.name })), [reasoning]);
  const recommended = Math.max(0, steps.findIndex(step => step.id === reasoning?.defaultEffort));
  const effortId = selected?.reasoningEffort ?? reasoning?.defaultEffort;
  const index = Math.max(0, steps.findIndex(step => step.id === effortId));
  const defaultActive = selected?.reasoningEffort === undefined;
  const effortLabel = defaultActive ? 'Default' : steps.find(step => step.id === effortId)?.label || 'Default';
  const busy = saving || state.status === 'selecting';
  const disabled = Boolean(locked || busy);

  React.useEffect(() => { if (available) load(); }, [available, load]);
  React.useEffect(() => () => { operation.current += 1; }, []);

  const close = () => { setPane(null); trigger.current?.focus({ preventScroll: true }); };
  const open = (next, event) => {
    trigger.current = event.currentTarget;
    setError('');
    setPane(pane === next ? null : next);
    if (state.status === 'idle' || state.status === 'error') load();
  };

  React.useLayoutEffect(() => {
    if (!pane || !popup.current) return;
    const element = popup.current;
    if (typeof element.showPopover === 'function' && !element.matches(':popover-open')) element.showPopover();
    const position = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      element.style.left = `${Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8))}px`;
      const above = anchor.top - height - 8;
      element.style.top = `${Math.max(8, above >= 8 ? above : Math.min(anchor.bottom + 8, window.innerHeight - height - 8))}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(element);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    const focus = pane === 'effort'
      ? element.querySelector('dsh-claude-effort-slider')
      : element.querySelector('[aria-selected="true"]') || element.querySelector('button');
    focus?.focus({ preventScroll: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      if (element.matches(':popover-open')) element.hidePopover();
    };
  }, [pane]);

  React.useEffect(() => {
    if (!pane) return;
    const outside = event => { if (!root.current?.contains(event.target)) setPane(null); };
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
    };
  }, [pane]);

  async function submit(selection, closeAfter = false) {
    if (disabled || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    const sequence = ++operation.current;
    try {
      const outcome = await select(selection);
      if (operation.current !== sequence) return;
      if (outcome === false || outcome?.ok === false) {
        throw new Error(outcome?.error?.message || directory.getSnapshot().error || '设置未保存，请重试。');
      }
      if (closeAfter) close();
    } catch (failure) {
      if (operation.current === sequence) setError(failure?.message || '设置未保存，请重试。');
    } finally {
      if (operation.current === sequence) {
        submitting.current = false;
        setSaving(false);
      }
    }
  }

  function chooseEffort(next) {
    if (!selected || !steps[next]) return;
    return submit({ provider: selected.provider, model: selected.model, reasoningEffort: steps[next].id });
  }

  if (!available) return null;
  const modelName = choice?.model.name || '选择模型';
  const maximum = !defaultActive && steps.length > 1 && index === steps.length - 1;
  const message = error || state.error;

  return h('div', { className: 'dsv-root', ref: root, 'data-saving': busy && !locked ? '' : undefined },
    h('button', {
      type: 'button', className: 'dsv-trigger', disabled,
      'aria-label': `选择模型，当前 ${modelName}`, 'aria-haspopup': 'dialog', 'aria-expanded': pane === 'model', 'aria-controls': pane === 'model' ? id : undefined,
      onClick: event => open('model', event),
    }, h(AnimatedLabel, { text: modelName })),
    choice && h('button', {
      type: 'button', className: 'dsv-trigger dsv-effort' + (maximum ? ' dsv-maximum' : ''), disabled,
      'aria-label': `推理等级，当前 ${effortLabel}`, 'aria-haspopup': 'dialog', 'aria-expanded': pane === 'effort', 'aria-controls': pane === 'effort' ? id : undefined,
      onClick: event => open('effort', event),
    }, h(AnimatedLabel, { text: effortLabel, order: index }), h('span', { 'aria-hidden': true, className: busy ? 'dsv-spinner' : 'dsv-chevron' }, busy ? '◌' : '⌄')),
    pane && h('div', { key: pane, id, ref: popup, popover: 'manual', role: 'dialog', 'aria-label': pane === 'effort' ? '推理等级' : '选择模型', 'aria-busy': busy, className: 'dsv-popup' + (pane === 'model' ? ' dsv-models' : '') },
      pane === 'effort' ? [
        steps.length ? h(EffortSlider, { key: 'slider', steps, value: index, recommended, defaultActive, disabled, saving: busy && !locked, onChange: chooseEffort })
          : h('p', { key: 'empty', className: 'dsv-status' }, '当前模型没有声明可选推理等级。'),
        h('button', {
          key: 'default', type: 'button', className: 'dsv-default', disabled,
          onClick: () => submit({ provider: selected.provider, model: selected.model }),
        }, 'Recommended', defaultActive ? ' · ✓' : ''),
      ] : [
        ...((state.groups || []).map(group => h('div', { key: group.id, className: 'dsv-group' },
          h('div', { className: 'dsv-group-name' }, group.name),
          h('div', { role: 'listbox', 'aria-label': group.name }, ...group.models.map(model => {
            const active = selected?.provider === group.id && selected?.model === model.id;
            return h('button', {
              key: model.id, type: 'button', role: 'option', 'aria-selected': active, disabled,
              className: 'dsv-model' + (active ? ' dsv-selected' : ''),
              onClick: () => {
                if (active) { close(); return; }
                const selection = { provider: group.id, model: model.id };
                if (model.reasoning?.defaultEffort !== undefined) selection.reasoningEffort = model.reasoning.defaultEffort;
                submit(selection, true);
              },
            }, h('span', null, model.name), active && h('span', { 'aria-hidden': true }, '✓'));
          })),
        ))),
        !choices.length && h('p', { key: 'status', className: 'dsv-status', role: 'status' }, state.status === 'loading' ? '正在加载模型…' : '暂无可用模型，请先在 DSH 中配置模型。'),
        ...(state.failures || []).map(failure => h('p', { key: failure.id, className: 'dsv-error' }, `${failure.name}: ${failure.message}`)),
      ],
      message && h('div', { className: 'dsv-error', role: 'alert' }, message),
      (message || state.failures?.length > 0) && h('button', { type: 'button', className: 'dsv-default', disabled, onClick: () => { setError(''); load(); } }, '重新加载'),
    ),
  );
}

const css = `
.dsv-root{display:inline-flex;align-items:center;gap:4px;max-width:100%;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.dsv-trigger{border:0;background:none;color:var(--dsw-alias-label-secondary,#aaa9a5);font:inherit;padding:4px 6px;border-radius:5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.dsv-trigger:hover,.dsv-trigger[aria-expanded=true]{background:var(--dsw-alias-bg-layer-2,#2b2b29);color:var(--dsw-alias-label-primary,#deddd8)}
.dsv-trigger:focus-visible,.dsv-popup button:focus-visible{outline:2px solid #ada0df;outline-offset:2px}
.dsv-trigger:disabled,.dsv-popup button:disabled{opacity:.45;cursor:default}
.dsv-root[data-saving] .dsv-trigger:disabled,.dsv-root[data-saving] .dsv-popup button:disabled{opacity:1}
.dsv-effort{display:flex;gap:6px;align-items:center;transition:color 160ms ease}.dsv-maximum{color:#a49bd7}.dsv-chevron{font-size:12px;color:#777772}.dsv-spinner{display:inline-block;animation:dsv-spin 900ms linear infinite}
.dsv-popup{position:fixed;inset:auto;margin:0;box-sizing:border-box;width:220px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);overflow:auto;border:1px solid #343432;border-radius:11px;background:#20201f;color:#c4c3c0;padding:12px 11px 10px;box-shadow:0 10px 26px #0005;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;z-index:1000;color-scheme:dark;animation:dsv-appear 130ms ease-out}
.dsv-popup::backdrop{background:transparent}.dsv-popup dsh-claude-effort-slider{width:100%}
.dsv-default{display:block;border:0;background:none;color:#82827b;font:inherit;font-size:11px;padding:3px 0;margin-top:7px;cursor:pointer}.dsv-default:hover{color:#c4c3c0}
.dsv-models{width:286px;padding:6px}.dsv-group+.dsv-group{margin-top:6px}.dsv-group-name{padding:6px 8px 3px;color:#777772;font-size:11px}
.dsv-model{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;border:0;background:none;color:#c4c3c0;border-radius:6px;padding:7px 8px;font:inherit;cursor:pointer;text-align:left}.dsv-model:hover,.dsv-selected{background:#323230}
.dsv-status{margin:5px 4px;color:#90908a;font-size:12px;line-height:1.6}.dsv-error{margin:9px 2px 0;color:#e6a99c;font-size:11px;white-space:normal;overflow-wrap:anywhere}
@keyframes dsv-appear{from{opacity:0;translate:0 3px}to{opacity:1;translate:0 0}}@keyframes dsv-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.dsv-popup,.dsv-spinner{animation:none}}
`;

return {
  inject: ['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'],
  apply(ctx) {
    const slots = ctx.slots;
    const sessions = ctx.sessions;
    const directories = ctx.modelDirectories;
    ctx.effect(() => {
      const style = document.createElement('style');
      style.dataset.pluginCss = 'dsh-claude-video-slider';
      style.textContent = css;
      document.head.append(style);
      return () => style.remove();
    });
    try {
      slots.inject('conversation.input.model', () => slots.register({
        name: 'conversation.input.model', priority: -20,
        inject(sessionId) {
          const directory = directories.directoryFor(sessionId);
          const available = sessions.subagentAddress(sessionId) === undefined;
          return {
            available, directory: directory.store,
            load: () => { if (available) directory.load().catch(() => {}); },
            select: selection => available ? directory.select(selection) : Promise.resolve(false),
          };
        },
      }, ModelControl));
    } catch (error) {
      ctx.effect(() => {
        const notice = document.createElement('div');
        notice.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#a33;color:#fff;font:12px/1.4 monospace;padding:6px 10px;border-radius:6px;pointer-events:none';
        notice.textContent = 'slider error: ' + (error?.message || String(error));
        document.body.append(notice);
        return () => notice.remove();
      });
    }
  },
};
