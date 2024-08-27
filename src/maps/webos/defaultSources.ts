import { IElementConfig } from '../../models';

/**
 *
 */
export const webosDefaultSources: IElementConfig[] = [
	{
		type: 'button',
		name: 'netflix',
		tap_action: {
			action: 'perform-action',
			perform_action: 'webos.button',
			data: {
				method: 'NETFLIX',
			},
		},
		icon: 'mdi:netflix',
	},
	{
		type: 'button',
		name: 'primevideo',
		tap_action: {
			action: 'perform-action',
			perform_action: 'webos.button',
			data: {
				method: 'AMAZON',
			},
		},
		icon: 'primevideo',
	},
];