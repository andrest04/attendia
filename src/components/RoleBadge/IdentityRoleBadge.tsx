import React from 'react';
import { isTeacherIdentity } from '../../classSession/classSessionTypes';
import RoleBadge from './RoleBadge';

type IdentityRoleBadgeProps = { identity: string | null | undefined } & React.ComponentProps<typeof RoleBadge>;

/**
 * Renders the teacher RoleBadge only when the Twilio identity carries the
 * `[Profesor]` suffix; renders nothing otherwise. The single place that couples
 * "is this identity a teacher" to the badge.
 */
export default function IdentityRoleBadge({ identity, ...badgeProps }: IdentityRoleBadgeProps) {
  return isTeacherIdentity(identity) ? <RoleBadge {...badgeProps} /> : null;
}
