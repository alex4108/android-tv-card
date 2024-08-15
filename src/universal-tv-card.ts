import packageInfo from '../package.json';

import { LitElement, TemplateResult, css, html } from 'lit';
import { property } from 'lit/decorators.js';

import { HomeAssistant } from 'custom-card-helpers';
import { renderTemplate } from 'ha-nunjucks';
import { load } from 'js-yaml';

import {
	ActionTypes,
	DirectionActions,
	IAction,
	IConfig,
	IElementConfig,
	defaultKeys,
	defaultSources,
} from './models';
import { mergeDeep } from './utils';

import './classes/keyboard-dialog';
import './classes/remote-button';
import './classes/remote-slider';
import './classes/remote-touchpad';
import { UniversalTVCardEditor } from './universal-tv-card-editor';

console.info(
	`%c UNIVERSAL-TV-CARD v${packageInfo.version}`,
	'color: white; font-weight: bold; background: green',
);

class UniversalTVCard extends LitElement {
	@property() hass!: HomeAssistant;
	@property() config!: IConfig;

	DEFAULT_ACTIONS = [
		...structuredClone(defaultSources),
		...structuredClone(defaultKeys),
	];

	nRows: number = 0;
	nColumns: number = 0;
	nPads: number = 0;
	editMode: boolean = false;

	static get properties() {
		return {
			hass: {},
			config: {},
		};
	}

	static getConfigElement() {
		return document.createElement('universal-tv-card-editor');
	}

	static getStubConfig() {
		return {
			type: 'custom:android-tv-card',
			rows: [],
		};
	}

	getCardSize() {
		let numRows = this.config.rows?.length ?? 0;
		if (this.config.title) {
			numRows += 1;
		}
		return numRows;
	}

	async setConfig(config: IConfig) {
		if (!config) {
			throw new Error('Invalid configuration');
		}
		this.config = config;
	}

	updateElementConfig(actions: IElementConfig) {
		// TODO only run this for default actions?
		const context = {
			config: {
				...actions,
				entity: renderTemplate(
					this.hass,
					actions.remote_id ??
						actions.media_player_id ??
						actions.keyboard_id ??
						'',
				),
				attribute: renderTemplate(
					this.hass,
					actions.value_attribute ?? '',
				),
			},
		};

		// [DEPRECATED] Apply template if defined
		if (actions.template) {
			const templateActions =
				this.config.custom_actions?.filter(
					(customActions) => actions.template == customActions.name,
				)[0] ??
				this.DEFAULT_ACTIONS.filter(
					(defaultActions) => actions.template == defaultActions.name,
				)[0] ??
				{};
			actions = mergeDeep(
				structuredClone(templateActions),
				actions,
			) as IElementConfig;
		}

		actions.autofill_entity_id =
			actions.autofill_entity_id ??
			this.config.autofill_entity_id ??
			true;
		if (
			renderTemplate(
				this.hass,
				actions.autofill_entity_id as unknown as string,
			)
		) {
			actions.entity_id =
				actions.entity_id ??
				this.config.remote_id ??
				this.config.media_player_id ??
				this.config.keyboard_id;
			actions.value_attribute = actions.value_attribute ?? 'state';
			actions.haptics = actions.haptics ?? this.config.haptics ?? true;

			actions.platform =
				actions.platform ?? this.config.platform ?? 'ANDROID TV';
			actions.keyboard_id =
				actions.keyboard_id ?? this.config.keyboard_id;
			actions.media_player_id =
				actions.media_player_id ??
				this.config.media_player_id ??
				(actions.entity_id?.startsWith('media_player.')
					? actions.entity_id
					: '');
			actions.remote_id =
				actions.remote_id ??
				this.config.remote_id ??
				(actions.entity_id?.startsWith('remote.')
					? actions.entity_id
					: '');

			for (const actionType of ActionTypes) {
				if (actions[actionType]) {
					const action = actions[actionType] ?? ({} as IAction);

					action.platform = action.platform ?? actions.platform;
					action.keyboard_id =
						action.keyboard_id ?? actions.keyboard_id;
					action.media_player_id =
						action.media_player_id ?? actions.media_player_id;
					action.remote_id = action.remote_id ?? actions.remote_id;

					let entityId: string | undefined;
					const [domain, _service] = (
						renderTemplate(
							this.hass,
							action.perform_action ??
								(action[
									'service' as 'perform_action'
								] as string) ??
								'',
							context,
						) as string
					).split('.');
					switch (domain) {
						case 'remote':
							entityId = action.remote_id;
							break;
						case 'media_player':
						case 'kodi':
						case 'denonavr':
							entityId = action.media_player_id;
							break;
						default:
							entityId = actions.entity_id;
							break;
					}

					if (
						entityId &&
						!action.data?.entity_id &&
						!action.data?.device_id &&
						!action.data?.area_id &&
						!action.data?.label_id &&
						!action.target?.entity_id &&
						!action.target?.device_id &&
						!action.target?.area_id &&
						!action.target?.label_id
					) {
						action.target = {
							...action.target,
							entity_id: entityId,
						};
					}

					actions[actionType] = action;
				}
			}

			// Set hold time if defined globally
			if (this.config.hold_time) {
				actions.hold_action = actions.hold_action ?? { action: 'none' };
				actions.hold_action.hold_time =
					actions.hold_action?.hold_time ?? this.config.hold_time;

				if (actions.multi_hold_action) {
					actions.multi_hold_action.hold_time =
						actions.multi_hold_action?.hold_time ??
						this.config.hold_time;
				}
			}

			// Set repeat delay if defined globally
			if (this.config.repeat_delay) {
				actions.hold_action = actions.hold_action ?? { action: 'none' };
				if (actions.hold_action?.action == 'repeat') {
					actions.hold_action.repeat_delay =
						actions.hold_action.repeat_delay ??
						this.config.repeat_delay;
				}
				if (
					actions.multi_hold_action &&
					actions.multi_hold_action?.action == 'repeat'
				) {
					actions.multi_hold_action.repeat_delay =
						actions.multi_hold_action.repeat_delay ??
						this.config.repeat_delay;
				}
			}

			// Set double tap window if defined globally
			if (this.config.double_tap_window) {
				actions.double_tap_action = actions.double_tap_action ?? {
					action: 'none',
				};
				actions.double_tap_action.double_tap_window =
					actions.double_tap_action.double_tap_window ??
					this.config.double_tap_window;
				if (actions.multi_double_tap_action) {
					actions.multi_double_tap_action.double_tap_window =
						actions.multi_double_tap_action.double_tap_window ??
						this.config.double_tap_window;
				}
			}
		}

		// Also update touchpad directions
		if (actions.type == 'touchpad') {
			for (const direction of DirectionActions) {
				actions[direction] = this.updateElementConfig(
					(actions[direction] ?? {}) as IElementConfig,
				);
			}
		}

		return actions;
	}

	getElementConfig(action: string): IElementConfig {
		const defaultActions =
			structuredClone(
				this.DEFAULT_ACTIONS.filter(
					(defaultActions) => defaultActions.name == action,
				)[0],
			) ?? {};
		let customActionsList = this.config.custom_actions;
		if (!Array.isArray(customActionsList)) {
			customActionsList = [];
		}
		const customActions =
			structuredClone(
				customActionsList.filter(
					(customActions) => customActions.name == action,
				)[0],
			) ?? {};
		let actions = {
			...defaultActions,
			...customActions,
		};

		actions = Object.keys(actions).length
			? this.updateElementConfig(actions)
			: actions;

		return actions;
	}

	buildRow(content: TemplateResult[]): TemplateResult {
		this.nRows++;
		const id = `row-${this.nRows}`;
		return html`
			<div
				class="row${this.editMode ? ' edit-mode' : ''}"
				id="${id}"
				title="${this.editMode ? `#${id}` : ''}"
			>
				${content}
			</div>
		`;
	}

	buildColumn(content: TemplateResult[]): TemplateResult {
		this.nColumns++;
		const id = `column-${this.nColumns}`;
		return html`
			<div
				class="column${this.editMode ? ' edit-mode' : ''}"
				id="${id}"
				title="${this.editMode ? `#${id}` : ''}"
			>
				${content}
			</div>
		`;
	}

	buildPad(buttons: string[]): TemplateResult {
		this.nPads++;
		const id = `pad-${this.nPads}`;
		return html`
			<div
				class="button-pad${this.editMode ? ' edit-mode' : ''}"
				id="${id}"
				title="${this.editMode ? `#${id}` : ''}"
			>
				${buttons.map((b) => this.buildButton(b))}
			</div>
		`;
	}

	buildButton(elementName: string, actions?: IElementConfig): TemplateResult {
		if (!actions) {
			actions = this.getElementConfig(elementName);
		}

		if (!Object.keys(actions).length) {
			return html`<div class="empty-button"></div>`;
		}

		actions.styles =
			(this.config.button_styles ?? '') + '\n' + (actions.styles ?? '');
		return html`<remote-button
			title="${elementName}"
			.hass=${this.hass}
			.config=${actions}
			.icons=${this.config.custom_icons}
		/>`;
	}

	buildSlider(elementName: string, actions: IElementConfig): TemplateResult {
		return html`<remote-slider
			title="${elementName}"
			.hass=${this.hass}
			.config=${actions}
			.icons=${this.config.custom_icons}
		/>`;
	}

	buildTouchpad(
		elementName: string,
		actions: IElementConfig,
	): TemplateResult {
		return html`<remote-touchpad
			title="${elementName}"
			.hass=${this.hass}
			.config=${actions}
			.icons=${this.config.custom_icons}
		/>`;
	}

	buildVolumeButtons(): TemplateResult[] {
		return [
			this.buildButton('volume_down'),
			this.buildButton('volume_mute'),
			this.buildButton('volume_up'),
		];
	}

	buildNavButtons(): TemplateResult {
		return this.buildColumn([
			this.buildRow([this.buildButton('up')]),
			this.buildRow([
				this.buildButton('left'),
				this.buildButton('center'),
				this.buildButton('right'),
			]),
			this.buildRow([this.buildButton('down')]),
		]);
	}

	buildElements(
		row: (string | string[])[],
		isColumn: boolean = false,
		context: object = {},
	) {
		if (typeof row == 'string') {
			row = [row];
		}
		const rowContent: TemplateResult[] = [];
		for (let elementName of row) {
			elementName = renderTemplate(
				this.hass,
				elementName as string,
				context,
			) as string;
			if (typeof elementName == 'string' && elementName.includes('- ')) {
				elementName = load(elementName) as string;
			}
			if (typeof elementName == 'object' && elementName != null) {
				rowContent.push(
					this.buildElements(elementName, !isColumn, context),
				);
			} else {
				// Special shortcuts
				switch (elementName) {
					case 'vol_buttons':
					case 'volume_buttons': {
						const volumeButtons = this.buildVolumeButtons();
						if (isColumn) {
							volumeButtons.reverse();
						}
						rowContent.push(...volumeButtons);
						break;
					}
					case 'nav_buttons':
					case 'navigation_buttons': {
						rowContent.push(this.buildNavButtons());
						break;
					}
					case 'dpad':
					case 'd_pad':
					case 'direction_pad': {
						rowContent.push(
							this.buildPad([
								'',
								'up',
								'',
								'left',
								'center',
								'right',
								'',
								'down',
								'',
							]),
						);
						break;
					}
					case 'numpad':
					case 'num_pad':
					case 'number_pad': {
						rowContent.push(
							this.buildPad([
								'n7',
								'n8',
								'n9',
								'n4',
								'n5',
								'n6',
								'n1',
								'n2',
								'n3',
							]),
						);
						break;
					}
					case 'xpad':
					case 'x_pad':
					case 'gamepad':
					case 'xgamepad':
					case 'x_gamepad':
						rowContent.push(
							this.buildPad([
								'',
								'y',
								'',
								'x',
								'',
								'b',
								'',
								'a',
								'',
							]),
						);
						break;
					case 'npad':
					case 'n_pad':
					case 'ngamepad':
					case 'n_gamepad':
						rowContent.push(
							this.buildPad([
								'',
								'x',
								'',
								'y',
								'',
								'a',
								'',
								'b',
								'',
							]),
						);
						break;
					// Deprecated names for remote elements
					case 'volume_slider':
						elementName = 'slider';
					// falls through
					case 'nav_touchpad':
					case 'navigation_touchpad':
						elementName = 'touchpad';
					// falls through
					default: {
						const actions = this.getElementConfig(elementName);
						switch (actions.type) {
							case 'slider':
								rowContent.push(
									this.buildSlider(elementName, actions),
								);
								break;

							case 'touchpad':
								rowContent.push(
									this.buildTouchpad(elementName, actions),
								);
								break;
							default:
								rowContent.push(
									this.buildButton(elementName, actions),
								);
								break;
						}
						break;
					}
				}
			}
		}
		return isColumn
			? this.buildColumn(rowContent)
			: this.buildRow(rowContent);
	}

	buildDialog() {
		return html`<keyboard-dialog .hass=${this.hass} />`;
	}

	render() {
		if (!this.config || !this.hass) {
			return html``;
		}

		this.editMode = Boolean(
			document
				.querySelector('home-assistant')
				?.shadowRoot?.querySelector('hui-dialog-edit-card')
				?.shadowRoot?.querySelector('ha-dialog'),
		);

		const context = {
			config: {
				...this.config,
				entity: renderTemplate(
					this.hass,
					this.config.remote_id ??
						this.config.media_player_id ??
						this.config.keyboard_id ??
						'',
				),
			},
		};

		const content: TemplateResult[] = [];

		this.nRows = 0;
		this.nColumns = 0;
		for (const row of this.config.rows ?? []) {
			const rowContent = this.buildElements(
				row as string[],
				false,
				context,
			);
			content.push(rowContent);
		}

		const styles = this.config.styles
			? html`
					<style>
						${(
							renderTemplate(
								this.hass,
								this.config.styles,
								context,
							) as string
						)
							.replace(/!important/g, '')
							.replace(/;/g, ' !important;')}
					</style>
			  `
			: '';

		return html`<ha-card
			.header="${renderTemplate(
				this.hass,
				this.config.title as string,
				context,
			)}"
			>${content}${this.buildDialog()}${styles}</ha-card
		>`;
	}

	static get styles() {
		return css`
			ha-card {
				padding: 12px;

				-webkit-tap-highlight-color: transparent;
				-webkit-tap-highlight-color: rgba(0, 0, 0, 0);
				--md-ripple-hover-opacity: var(--ha-ripple-hover-opacity, 0.08);
				--md-ripple-pressed-opacity: var(
					--ha-ripple-pressed-opacity,
					0.12
				);
				--ha-ripple-color: var(--secondary-text-color);
				--mdc-ripple-hover-color: var(
					--ha-ripple-hover-color,
					var(--ha-ripple-color, var(--secondary-text-color))
				);
				--md-ripple-pressed-color: var(
					--ha-ripple-pressed-color,
					var(--ha-ripple-color, var(--secondary-text-color))
				);
			}

			.row {
				display: flex;
				flex-wrap: nowrap;
				flex-direction: row;
				width: -moz-available;
				width: -webkit-fill-available;
				width: fill-available;
				flex: 1;
				padding: 4px;
				gap: 8px;
				justify-content: space-evenly;
				align-items: center;
			}
			.column {
				display: flex;
				flex-wrap: nowrap;
				flex-direction: column;
				width: -moz-available;
				width: -webkit-fill-available;
				width: fill-available;
				flex: 1;
				padding: 4px;
				justify-content: space-evenly;
				align-items: center;
			}
			.edit-mode {
				outline: none;
			}
			@media (hover: hover) {
				.edit-mode:hover {
					outline: 1px dashed var(--red-color);
				}
			}

			.empty-button {
				width: var(--size, 48px);
				height: var(--size, 48px);
				position: relative;
			}
			.button-pad {
				display: grid;
				grid-template-rows: repeat(3, var(--size, 48px));
				grid-template-columns: repeat(3, var(--size, 48px));
				grid-gap: 8px 16px;
			}
		`;
	}
}

customElements.define('universal-tv-card-editor', UniversalTVCardEditor);
customElements.define('android-tv-card', UniversalTVCard); // Keep old name to not break old configs

window.customCards = window.customCards || [];
window.customCards.push({
	type: 'android-tv-card',
	name: 'Universal TV Card',
	description: 'Super customizable universal tv remote card',
});

if (!window.structuredClone) {
	window.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
if (!window.performance) {
	window.performance = window.Date as unknown as Performance;
}
