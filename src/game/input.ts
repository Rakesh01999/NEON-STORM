export interface Stick {
  active: boolean;
  id: number;
  ox: number; // origin (canvas-local px)
  oy: number;
  dx: number; // current displacement
  dy: number;
}

const stickInit = (): Stick => ({ active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 });

const STICK_RADIUS = 62;
const STICK_DEADZONE = 9;

/**
 * Unified keyboard / mouse / multi-touch input with dual virtual sticks.
 * Left half of the screen = movement stick, right half = aim + fire.
 */
export class InputManager {
  keys = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  mouseDown = false;
  mouseActive = false; // has the mouse ever moved this session
  moveStick: Stick = stickInit();
  aimStick: Stick = stickInit();
  usingTouch = false;
  onPause: (() => void) | null = null;

  private el: HTMLElement | null = null;
  private bombQueue = 0;

  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('contextmenu', this.onContextMenu);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    if (this.el) {
      this.el.removeEventListener('pointerdown', this.onPointerDown);
      this.el.removeEventListener('contextmenu', this.onContextMenu);
    }
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.el = null;
    this.keys.clear();
    this.mouseDown = false;
    this.moveStick = stickInit();
    this.aimStick = stickInit();
  }

  /* ---------------- keyboard ---------------- */

  private onKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    if (
      c === 'ArrowUp' || c === 'ArrowDown' || c === 'ArrowLeft' || c === 'ArrowRight' ||
      c === 'Space'
    ) {
      e.preventDefault();
    }
    if (e.repeat) return;
    if (c === 'Escape' || c === 'KeyP') {
      this.onPause?.();
      return;
    }
    if (c === 'Space' || c === 'KeyQ' || c === 'KeyE') {
      this.bombQueue++;
      return;
    }
    this.keys.add(c);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouseDown = false;
    this.moveStick = stickInit();
    this.aimStick = stickInit();
  };

  /* ---------------- pointer ---------------- */

  private toLocal(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.el) return { x: clientX, y: clientY };
    const r = this.el.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.el) return;
    if (e.pointerType === 'mouse') {
      if (e.button === 0) this.mouseDown = true;
      else if (e.button === 2 || e.button === 1) {
        this.bombQueue++;
        e.preventDefault();
      }
      const p = this.toLocal(e.clientX, e.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
      return;
    }
    // touch / pen → virtual sticks
    this.usingTouch = true;
    e.preventDefault();
    const p = this.toLocal(e.clientX, e.clientY);
    const w = this.el.clientWidth || window.innerWidth;
    if (p.x < w * 0.5) {
      if (!this.moveStick.active) {
        this.moveStick = { active: true, id: e.pointerId, ox: p.x, oy: p.y, dx: 0, dy: 0 };
      }
    } else if (!this.aimStick.active) {
      this.aimStick = { active: true, id: e.pointerId, ox: p.x, oy: p.y, dx: 0, dy: 0 };
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      const p = this.toLocal(e.clientX, e.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
      this.mouseActive = true;
      return;
    }
    if (!this.el) return;
    // Don't hijack touches that are interacting with page UI (menus, scroll areas)
    if (e.target !== this.el && !this.moveStick.active && !this.aimStick.active) return;
    e.preventDefault();
    const p = this.toLocal(e.clientX, e.clientY);
    const upd = (st: Stick) => {
      let dx = p.x - st.ox;
      let dy = p.y - st.oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        // drag the origin along so the knob stays at max radius
        st.ox = p.x - (dx / len) * STICK_RADIUS;
        st.oy = p.y - (dy / len) * STICK_RADIUS;
        dx = p.x - st.ox;
        dy = p.y - st.oy;
      }
      st.dx = dx;
      st.dy = dy;
    };
    if (this.moveStick.active && this.moveStick.id === e.pointerId) upd(this.moveStick);
    if (this.aimStick.active && this.aimStick.id === e.pointerId) upd(this.aimStick);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 0) this.mouseDown = false;
      return;
    }
    if (this.moveStick.active && this.moveStick.id === e.pointerId) this.moveStick = stickInit();
    if (this.aimStick.active && this.aimStick.id === e.pointerId) this.aimStick = stickInit();
  };

  private onContextMenu = (e: Event) => e.preventDefault();

  /* ---------------- queries ---------------- */

  getMove(): { x: number; y: number } {
    if (this.moveStick.active) {
      const len = Math.hypot(this.moveStick.dx, this.moveStick.dy);
      if (len > STICK_DEADZONE) {
        const m = Math.min(1, (len - STICK_DEADZONE) / (STICK_RADIUS - STICK_DEADZONE));
        return { x: (this.moveStick.dx / len) * m, y: (this.moveStick.dy / len) * m };
      }
      return { x: 0, y: 0 };
    }
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  /** Aim direction from the right stick, or null when idle. */
  getStickAim(): { x: number; y: number } | null {
    if (!this.aimStick.active) return null;
    const len = Math.hypot(this.aimStick.dx, this.aimStick.dy);
    if (len < STICK_DEADZONE) return null;
    return { x: this.aimStick.dx / len, y: this.aimStick.dy / len };
  }

  get firing(): boolean {
    if (this.mouseDown) return true;
    return this.getStickAim() !== null;
  }

  consumeBomb(): boolean {
    if (this.bombQueue > 0) {
      this.bombQueue = 0;
      return true;
    }
    return false;
  }

  queueBomb() {
    this.bombQueue++;
  }
}
