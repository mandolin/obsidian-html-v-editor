const WIDGET_MOUSE_EVENTS = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "dblclick",
  "auxclick"
];

export function stopObsidianContextMenu(el: HTMLElement | Document): void {
  el.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
}

export function stopObsidianContextMenuBubble(el: HTMLElement | Document): void {
  el.addEventListener("contextmenu", (event) => {
    event.stopPropagation();
  });
}

export function stopObsidianMouseBubble(el: HTMLElement): void {
  for (const type of WIDGET_MOUSE_EVENTS) {
    el.addEventListener(type, (event) => {
      event.stopPropagation();
    });
  }
  stopObsidianContextMenu(el);
}

export function protectObsidianButton(button: HTMLElement): void {
  for (const type of WIDGET_MOUSE_EVENTS) {
    button.addEventListener(type, (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, true);
  }
  button.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  stopObsidianContextMenu(button);
}

export function isolateObsidianControl(control: HTMLElement): void {
  for (const type of [...WIDGET_MOUSE_EVENTS, "click"]) {
    control.addEventListener(type, (event) => {
      event.stopPropagation();
    }, true);
  }
  control.addEventListener("contextmenu", (event) => {
    event.stopPropagation();
  }, true);
}
