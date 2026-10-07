/**
 * Roles. In the demo and the local build they are simulated with the role picker.
 * - beheerder: uploads the exports, sees the exception list and the dashboard
 * - gebruiker: HR colleagues of IJK; dashboard only
 */
export type Rol = 'beheerder' | 'gebruiker';

export const heeftToegang = (rollen: readonly Rol[]) => rollen.length > 0;
export const magBeheren = (rollen: readonly Rol[]) => rollen.includes('beheerder');
