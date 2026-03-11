// @flow

import * as React from 'react';
import { Trans } from '@lingui/macro';
import Dialog, { DialogPrimaryButton } from '../Dialog';
import FlatButton from '../FlatButton';
import LeftLoader from '../LeftLoader';
import AlertMessage from '../AlertMessage';
import { ColumnStackLayout } from '../Layout';
import { acceptTeamInvitation } from '../../Utils/GDevelopServices/User';
import { markNotificationsAsSeen } from '../../Utils/GDevelopServices/Notification';

type Props = {|
  teamId: string,
  notificationId: string,
  onClose: () => void,
  getAuthorizationHeader: () => Promise<string>,
  userId: string,
  onRefreshNotifications: () => Promise<void>,
|};

const TeamInvitationDialog = ({
  teamId,
  notificationId,
  onClose,
  getAuthorizationHeader,
  userId,
  onRefreshNotifications,
}: Props): React.Node => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<?React.Node>(null);

  const onAccept = React.useCallback(
    async () => {
      setIsLoading(true);
      setError(null);
      try {
        await acceptTeamInvitation(getAuthorizationHeader, {
          userId,
          teamId,
        });
        await markNotificationsAsSeen(getAuthorizationHeader, {
          notificationIds: [notificationId],
          userId,
        });
        await onRefreshNotifications();
        onClose();
      } catch (err) {
        console.error(
          'An error occurred while accepting team invitation:',
          err
        );
        setError(
          <Trans>
            An error occurred while accepting the invitation. Please try again
            later.
          </Trans>
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      getAuthorizationHeader,
      userId,
      teamId,
      notificationId,
      onRefreshNotifications,
      onClose,
    ]
  );

  return (
    <Dialog
      title={<Trans>Team invitation</Trans>}
      actions={[
        <FlatButton
          label={<Trans>Ignore</Trans>}
          disabled={isLoading}
          key="ignore"
          onClick={onClose}
        />,
        <LeftLoader isLoading={isLoading} key="accept">
          <DialogPrimaryButton
            label={<Trans>Accept</Trans>}
            primary
            onClick={onAccept}
            disabled={isLoading}
          />
        </LeftLoader>,
      ]}
      maxWidth="sm"
      cannotBeDismissed={isLoading}
      onRequestClose={onClose}
      onApply={onAccept}
      open
    >
      <ColumnStackLayout noMargin>
        <Trans>
          You've been invited to join a team as a student. Accept to become a
          member.
        </Trans>
        {error && <AlertMessage kind="error">{error}</AlertMessage>}
      </ColumnStackLayout>
    </Dialog>
  );
};

export default TeamInvitationDialog;
