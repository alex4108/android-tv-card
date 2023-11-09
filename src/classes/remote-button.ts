import { HapticType } from 'custom-card-helpers';

import { TemplateResult, CSSResult, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { IAction } from '../models';
import { BaseRemoteElement } from './base-remote-element';

@customElement('remote-button')
export class RemoteButton extends BaseRemoteElement {
	@property({ attribute: false }) info!: IAction;
	@property({ attribute: false }) actionKey!: string;
	@property({ attribute: false }) customIcon?: string;

	timer?: ReturnType<typeof setTimeout>;
	interval?: ReturnType<typeof setInterval>;

	onClick(_e: Event, longPress: boolean = false) {
		let haptic: HapticType = longPress ? 'medium' : 'light';
		if (['up', 'down', 'left', 'right'].includes(this.actionKey)) {
			haptic = 'selection';
		}
		this.fireHapticEvent(haptic);

		this.sendAction(this.info, longPress);
	}

	onlongClickStart(e: Event) {
		this.timer = setTimeout(() => {
			this.longPress = true;

			// Only repeat hold action for directional keys and volume
			// prettier-ignore
			if (['up', 'down', 'left', 'right', 'volume_up', 'volume_down', 'delete'].includes(this.actionKey)) {
				this.interval = setInterval(() => {
					this.onClick(e, false)
				}, 100);
			} else {
				this.onClick(e, true)
			}
		}, 500);
	}

	onlongClickEnd(e: Event) {
		if (this.longPress) {
			this.longPress = false;
			e.stopImmediatePropagation();
			e.preventDefault();
		}

		clearTimeout(this.timer as ReturnType<typeof setTimeout>);
		clearInterval(this.interval as ReturnType<typeof setInterval>);

		this.timer = undefined;
		this.interval = undefined;
	}

	render(inputTemplate?: TemplateResult<1>) {
		const icon = this.info.icon;
		const svgPath = this.info.svg_path ?? this.customIcon;

		let haIcon = html``;
		if (icon) {
			haIcon = html`<ha-icon .icon="${icon}"></ha-icon>`;
		}

		return html`
			<ha-icon-button
				title="${this.actionKey}"
				style=${styleMap(this._style ?? {})}
				@click=${this.onClick}
				@touchstart=${this.onlongClickStart}
				@touchend=${this.onlongClickEnd}
				.action=${this.actionKey}
				.path=${svgPath}
			>
				${haIcon}${inputTemplate}
			</ha-icon-button>
		`;
	}

	static get styles(): CSSResult | CSSResult[] {
		return [
			super.styles as CSSResult,
			css`
				ha-icon-button,
				ha-icon,
				svg {
					display: flex;
					height: var(--size);
					width: var(--size);
				}
				ha-icon-button {
					cursor: pointer;
					position: relative;
					display: inline-flex;
					flex-direction: column;
					align-content: center;
					justify-content: center;
					text-align: center;
					align-items: center;

					--size: 48px;
					--mdc-icon-size: var(--size);
					--mdc-icon-button-size: var(--size);
				}
			`,
		];
	}
}
