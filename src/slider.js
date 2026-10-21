/* Standalone visual component. No framework, assets, network requests or timers. */
(() => {
  const tag = 'dsh-claude-effort-slider';
  const pluginVersion = '1.0.11';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const fallbackSteps = ['Low', 'Medium', 'High', 'Extra', 'Max', 'Ultracode']
    .map(label => ({ id: label.toLowerCase(), label }));

  class ClaudeSliderLabel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `<style>
        :host{display:inline-grid;position:relative;vertical-align:bottom;min-width:0;max-width:100%}
        .current{grid-area:1/1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .outgoing{position:absolute;top:0;left:0;white-space:nowrap;pointer-events:none}
      </style><span class="current"></span>`;
      this._current = this.shadowRoot.querySelector('.current');
      this._text = '';
      this._order = 0;
      this._motions = [];
    }

    setLabel(text, order = 0) {
      const label = String(text ?? '');
      const direction = order < this._order ? -1 : 1;
      this._order = order;
      if (label === this._text) return;
      const previous = this._text;
      const style = previous && this.isConnected ? getComputedStyle(this._current) : null;
      const from = style ? { opacity: style.opacity, transform: style.transform, filter: style.filter } : null;
      this._motions.forEach(motion => motion.cancel());
      this._motions = [];
      this.shadowRoot.querySelector('.outgoing')?.remove();
      this._text = label;
      this._current.textContent = label;
      if (!previous || !this.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const outgoing = document.createElement('span');
      outgoing.className = 'outgoing';
      outgoing.textContent = previous;
      outgoing.setAttribute('aria-hidden', 'true');
      this.shadowRoot.append(outgoing);
      const options = { duration: 220, easing: 'cubic-bezier(.22,.61,.36,1)' };
      const enter = this._current.animate([
        { opacity: 0, transform: `translateY(${direction * 8}px)`, filter: 'blur(2px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
      ], options);
      const leave = outgoing.animate([
        from,
        { opacity: 0, transform: `translateY(${-direction * 8}px)`, filter: 'blur(2px)' },
      ], { ...options, fill: 'forwards' });
      leave.finished.then(() => outgoing.remove(), () => outgoing.remove());
      this._motions = [enter, leave];
    }

    disconnectedCallback() {
      this._motions.forEach(motion => motion.cancel());
      this._motions = [];
      this.shadowRoot.querySelector('.outgoing')?.remove();
    }
  }

  if (!customElements.get('dsh-claude-slider-label')) customElements.define('dsh-claude-slider-label', ClaudeSliderLabel);
  if (customElements.get(tag)) return;

  class ClaudeEffortSlider extends HTMLElement {
    static observedAttributes = ['disabled', 'label', 'axis-low', 'axis-high'];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._steps = fallbackSteps;
      this._value = 1;
      this._recommended = 1;
      this._defaultActive = false;
      this._drag = null;
      this.shadowRoot.innerHTML = `
        <style>
          :host{display:block;box-sizing:border-box;width:220px;color:#c4c3c0;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark;--position:.2;--surface:#20201f;--track:#30302f;--muted:#81817d;--accent:#a49bd7}
          *,*::before,*::after{box-sizing:border-box}
          .panel{padding:12px 11px 10px;background:var(--surface);border:1px solid #343432;border-radius:11px;box-shadow:0 10px 26px #0005}
          :host([inline]) .panel{padding:0;background:none;border:0;border-radius:0;box-shadow:none}
          .heading{display:flex;align-items:center;gap:8px;min-height:18px;margin-bottom:20px;white-space:nowrap}
          .label{color:var(--muted)}
          .value{font-weight:400;transition:color 160ms ease}
          .help{margin-left:auto;color:var(--muted);width:20px;height:18px;border:0;padding:0;background:none;display:grid;place-items:center;cursor:pointer}
          .help span{width:12px;height:12px;border:1px solid currentColor;border-radius:50%;display:grid;place-items:center;font-size:9px;line-height:1}
          .help:hover,.help[aria-expanded=true]{color:#c4c3c0}
          .help:focus-visible,.info-close:focus-visible{outline:2px solid #b4a6e4;outline-offset:3px;border-radius:4px}
          .info{margin-top:12px;padding-top:11px;border-top:1px solid #ffffff18;font-size:11px;line-height:1.7;color:#a3a29a}
          .info[hidden]{display:none}
          .info-heading{display:flex;align-items:center;gap:8px;color:#d2d0c8;font-size:12px}
          .info-heading strong{font-weight:500}
          .info-close{margin-left:auto;border:0;background:none;padding:0 3px;color:var(--muted);font:inherit;font-size:16px;line-height:1.2;cursor:pointer}
          .info-close:hover{color:#d2d0c8}
          .info p{margin:6px 0}
          .info-version{color:var(--accent)}
          .info-id{display:block;color:var(--muted);font:10px/1.6 ui-monospace,monospace;overflow-wrap:anywhere}
          .axis{display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px;color:var(--muted)}
          .track{position:relative;height:20px;border-radius:6px;background:var(--track);cursor:default;touch-action:none;user-select:none;outline:none;isolation:isolate}
          .track:focus-visible{outline:2px solid #b4a6e4;outline-offset:4px}
          .track.pointer-focus:focus-visible{outline:none}
          .fill{position:absolute;inset:0 auto 0 0;width:calc(8px + (100% - 16px)*var(--position));border-radius:6px;background:#727270;transition:width 210ms cubic-bezier(.22,1.35,.36,1),opacity 260ms ease}
          .tick{position:absolute;z-index:2;top:50%;width:3px;height:3px;border-radius:50%;background:#777774;transform:translate(-50%,-50%);pointer-events:none}
          .tick.recommended{height:9px;width:3px;border-radius:2px;background:#7e7e7a}
          .thumb{position:absolute;z-index:4;left:calc(8px + (100% - 16px)*var(--position));top:50%;width:16px;height:22px;border-radius:6px;background:#fff;box-shadow:0 0 0 .5px #ffffff30,0 1px 2px #0002;transform:translate(-50%,-50%);transition:left 210ms cubic-bezier(.22,1.35,.36,1),width 140ms;pointer-events:none}
          .track.dragging .fill{transition:opacity 260ms ease}
          .track.dragging .thumb{transition:none}
          .track.dragging .thumb{width:17px}
          .pixels{position:absolute;inset:1px 2px;z-index:1;overflow:hidden;border-radius:5px;opacity:0;pointer-events:none;mask-image:linear-gradient(90deg,transparent,#000 65%);clip-path:inset(0 calc((100% - 12px)*(1 - var(--position))) 0 0);transition:opacity 320ms cubic-bezier(.22,.61,.36,1),clip-path 210ms cubic-bezier(.22,1.35,.36,1)}
          .track.dragging .pixels{transition-property:opacity}
          .cells{display:grid;grid-template-columns:repeat(48,1fr);grid-template-rows:repeat(5,1fr);gap:1px;width:100%;height:100%}
          .pixel{border-radius:.35px;opacity:0;transform:scale(.35)}
          .pixel::before{content:"";display:block;width:100%;height:100%;background:#aaa0df;border-radius:inherit;opacity:var(--opacity);animation:flicker var(--duration) ease-in-out var(--delay) infinite alternate;animation-play-state:paused}
          .maximum .pixels{opacity:1;transition-duration:160ms,210ms}
          .burning .pixel{animation:ignite var(--ignite-duration) ease-out var(--ignite-delay) both;animation-play-state:paused}
          .burning.settled .pixel{animation:none;opacity:1;transform:scale(1)}
          .maximum.settled .pixels{transition:none}
          .maximum .pixel{animation-play-state:running}
          .burning .pixel::before{animation-play-state:running}
          .maximum .fill{opacity:0}
          .maximum .value{color:var(--accent)}
          :host([disabled]:not([saving])) .track{opacity:.42}
          :host([disabled]:not([saving])) .pixel,:host([disabled]:not([saving])) .pixel::before{animation-play-state:paused}
          @keyframes ignite{from{opacity:0;transform:scale(.35)}to{opacity:1;transform:scale(1)}}
          @keyframes flicker{from{opacity:var(--opacity)}to{opacity:var(--bright)}}
          @media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}.maximum .pixel{opacity:1;transform:none}}
        </style>
        <div class="panel">
          <div class="heading"><span class="label">Effort</span><dsh-claude-slider-label class="value"></dsh-claude-slider-label><button class="help" type="button" title="插件信息" aria-label="插件信息" aria-expanded="false" aria-controls="plugin-info"><span aria-hidden="true">?</span></button></div>
          <div class="axis"><span class="axis-low">Faster</span><span class="axis-high">Smarter</span></div>
          <div class="track" role="slider" tabindex="0" aria-label="Reasoning effort" aria-orientation="horizontal">
            <div class="fill"></div><div class="pixels" aria-hidden="true"><div class="cells"></div></div>
            <div class="ticks" aria-hidden="true"></div><div class="thumb" aria-hidden="true"></div>
          </div>
          <section class="info" id="plugin-info" aria-label="插件信息" hidden>
            <div class="info-heading"><strong>DSH Claude 视频滑块</strong><button class="info-close" type="button" aria-label="关闭插件信息" title="关闭">×</button></div>
            <span class="info-version">v${pluginVersion}</span>
            <p>Claude 风格的模型与推理等级选择器，支持滑块吸附与最高档紫色像素动画。可选档位由当前模型提供。</p>
            <code class="info-id">dsh-claude-video-slider</code>
          </section>
        </div>`;
      const find = selector => this.shadowRoot.querySelector(selector);
      this._panel = find('.panel');
      this._track = find('.track');
      this._title = find('.value');
      this._ticks = find('.ticks');
      this._pixels = find('.pixels');
      this._pixels.addEventListener('transitionend', event => {
        if (event.target === this._pixels && event.propertyName === 'opacity' && !this._panel.classList.contains('maximum')) {
          this._panel.classList.remove('burning', 'settled');
        }
      });
      this._help = find('.help');
      this._info = find('.info');
      this._help.addEventListener('click', () => this._showInfo(this._info.hidden));
      find('.info-close').addEventListener('click', () => this._showInfo(false));
      this.shadowRoot.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || this._info.hidden || this._drag) return;
        event.preventDefault();
        event.stopPropagation();
        this._showInfo(false);
      });
      const cells = find('.cells');
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 240; index++) {
        const seed = ((index * 73 + 19) % 101) / 100;
        const column = index % 48;
        const row = Math.floor(index / 48);
        // Ignite from the thumb toward the left, with an uneven, softly fading front.
        const ignition = Math.max(0, (47 - column) / 47 * 2000
          + Math.abs(row - 2) * 26 + Math.sin(column * .8 + row * 1.7) * 40 + seed * 70);
        const pixel = document.createElement('span');
        pixel.className = 'pixel';
        pixel.style.cssText = `--opacity:${.16 + seed * .23};--bright:${.42 + seed * .46};--duration:${650 + seed * 1250}ms;--delay:${-index * 37}ms;--ignite-delay:${ignition}ms;--ignite-duration:${180 + seed * 160}ms`;
        fragment.append(pixel);
      }
      cells.append(fragment);
      this._track.addEventListener('pointerdown', event => this._start(event));
      this._track.addEventListener('pointermove', event => this._move(event));
      this._track.addEventListener('pointerup', event => this._finish(event));
      this._track.addEventListener('pointercancel', () => this._cancel());
      this._track.addEventListener('lostpointercapture', () => this._cancel());
      this._track.addEventListener('keydown', event => this._key(event));
      this._track.addEventListener('blur', () => this._track.classList.remove('pointer-focus'));
      this._drawTicks();
      this._paint(this._value);
    }

    connectedCallback() { this._syncAttributes(); }
    disconnectedCallback() { this._cancel(); }
    attributeChangedCallback() { this._syncAttributes(); }
    focus(options) { this._track.focus(options); }

    _showInfo(open) {
      this._info.hidden = !open;
      this._help.setAttribute('aria-expanded', String(open));
      if (!open) this._help.focus({ preventScroll: true });
    }

    get steps() { return this._steps.map(step => ({ ...step })); }
    set steps(value) {
      if (!Array.isArray(value) || !value.length) return;
      const ids = new Set();
      const steps = value.filter(step => step && typeof step.id === 'string' && !ids.has(step.id) && ids.add(step.id))
        .map(step => ({ id: step.id, label: String(step.label ?? step.name ?? step.id) }));
      if (!steps.length) return;
      this._cancel();
      this._steps = steps;
      this._value = clamp(this._value, 0, steps.length - 1);
      this._recommended = clamp(this._recommended, 0, steps.length - 1);
      this._drawTicks();
      this._paint(this._value);
    }

    get value() { return this._value; }
    set value(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      this._cancel();
      this._value = clamp(Math.round(number), 0, this._steps.length - 1);
      this._paint(this._value);
    }

    get recommended() { return this._recommended; }
    set recommended(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      this._recommended = clamp(Math.round(number), 0, this._steps.length - 1);
      this._drawTicks();
    }

    get defaultActive() { return this._defaultActive; }
    set defaultActive(value) { this._defaultActive = Boolean(value); this._paint(this._value); }
    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(value) { this.toggleAttribute('disabled', Boolean(value)); }

    _syncAttributes() {
      if (!this._track) return;
      if (this.disabled) this._cancel();
      this._track.tabIndex = this.disabled ? -1 : 0;
      this._track.setAttribute('aria-disabled', String(this.disabled));
      for (const [selector, attribute, fallback] of [
        ['.label', 'label', 'Effort'], ['.axis-low', 'axis-low', 'Faster'],
        ['.axis-high', 'axis-high', 'Smarter'],
      ]) this.shadowRoot.querySelector(selector).textContent = this.getAttribute(attribute) ?? fallback;
    }

    _drawTicks() {
      this._ticks.replaceChildren();
      this._steps.forEach((step, index) => {
        const tick = document.createElement('span');
        tick.className = 'tick' + (index === this._recommended ? ' recommended' : '');
        tick.style.left = `calc(8px + (100% - 16px)*${index / Math.max(1, this._steps.length - 1)})`;
        this._ticks.append(tick);
      });
    }

    _paint(position, preview = false, animate = preview) {
      const index = clamp(Math.round(position), 0, this._steps.length - 1);
      const maximum = index === this._steps.length - 1 && this._steps.length > 1 && (!this._defaultActive || preview);
      const label = this._defaultActive && !preview ? 'Default' : this._steps[index].label;
      this._panel.style.setProperty('--position', position / Math.max(1, this._steps.length - 1));
      if (maximum) {
        if (!this._panel.classList.contains('burning')) {
          this._panel.classList.toggle('settled', !animate);
        } else if (animate && !this._panel.classList.contains('maximum')) {
          this._panel.classList.remove('settled');
        }
        this._panel.classList.add('burning');
      } else if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this._panel.classList.remove('burning', 'settled');
      }
      this._panel.classList.toggle('maximum', maximum);
      this._title.setLabel(label, index);
      this._track.setAttribute('aria-valuemin', '0');
      this._track.setAttribute('aria-valuemax', String(this._steps.length - 1));
      this._track.setAttribute('aria-valuenow', String(index));
      this._track.setAttribute('aria-valuetext', label);
    }

    _position(clientX) {
      const rect = this._track.getBoundingClientRect();
      return clamp((clientX - rect.left - 8) / Math.max(1, rect.width - 16), 0, 1) * (this._steps.length - 1);
    }

    _emit(type, index) {
      const step = this._steps[index];
      this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail: { index, id: step.id, label: step.label } }));
    }

    _start(event) {
      if (this.disabled || !event.isPrimary || event.button !== 0 || this._drag) return;
      event.preventDefault();
      this._track.classList.add('pointer-focus');
      this._track.focus({ preventScroll: true });
      this._drag = { pointer: event.pointerId, position: this._position(event.clientX) };
      this._track.setPointerCapture(event.pointerId);
      this._track.classList.add('dragging');
      this._paint(this._drag.position, true);
      this._emit('input', Math.round(this._drag.position));
    }

    _move(event) {
      if (!this._drag || event.pointerId !== this._drag.pointer) return;
      this._drag.position = this._position(event.clientX);
      this._paint(this._drag.position, true);
      this._emit('input', Math.round(this._drag.position));
    }

    _finish(event) {
      if (!this._drag || event.pointerId !== this._drag.pointer) return;
      const index = Math.round(this._position(event.clientX));
      const pointer = this._drag.pointer;
      this._drag = null;
      this._track.classList.remove('dragging');
      if (this._track.hasPointerCapture(pointer)) this._track.releasePointerCapture(pointer);
      this._commit(index);
    }

    _cancel() {
      if (!this._drag) return;
      const pointer = this._drag.pointer;
      this._drag = null;
      this._track.classList.remove('dragging');
      if (this._track.hasPointerCapture(pointer)) this._track.releasePointerCapture(pointer);
      this._paint(this._value);
    }

    _commit(index) {
      const changed = index !== this._value || this._defaultActive;
      this._defaultActive = false;
      this._value = index;
      this._paint(index, false, true);
      if (changed) this._emit('change', index);
    }

    _key(event) {
      this._track.classList.remove('pointer-focus');
      if (event.key === 'Escape' && this._drag) { event.preventDefault(); event.stopPropagation(); this._cancel(); return; }
      if (this.disabled || this._drag) return;
      const values = { ArrowLeft: this._value - 1, ArrowDown: this._value - 1, ArrowRight: this._value + 1, ArrowUp: this._value + 1, Home: 0, End: this._steps.length - 1, PageDown: this._value - 2, PageUp: this._value + 2 };
      if (!(event.key in values)) return;
      event.preventDefault();
      event.stopPropagation();
      this._commit(clamp(values[event.key], 0, this._steps.length - 1));
    }
  }

  customElements.define(tag, ClaudeEffortSlider);
})();
