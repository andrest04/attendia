import React, { useMemo } from 'react';
import CloseIcon from '@material-ui/icons/Close';
import { useParams } from 'react-router-dom';

import AttentionReportView from '../AttentionReport/AttentionReportView';
import { storedReportToViewData } from '../AttentionReport/storedReportViewData';
import StandalonePage, { PageMessageCard, PageNavButton, PageTitle } from '../StandalonePage/StandalonePage';
import useAsyncResource from '../../hooks/useAsyncResource/useAsyncResource';
import { useAppState } from '../../state';
import { t } from '../../i18n/translate';

/*
 * Standalone "Reporte de Atención" page, opened in a NEW TAB from the in-room
 * dashboard history. It loads only the authenticated teacher's persisted report;
 * the route is protected and the server scopes reads to the verified Firebase uid.
 */

export default function ReportPage() {
  const { roomSid } = useParams<{ roomSid: string }>();
  const { fetchAttentionReport } = useAppState();

  const load = useMemo(
    () =>
      fetchAttentionReport
        ? () =>
            fetchAttentionReport(roomSid).then(storedReportToViewData, err => {
              console.error('ReportPage: could not fetch the report', { roomSid, error: err });
              throw err;
            })
        : null,
    [fetchAttentionReport, roomSid]
  );
  const { data, error: loadError } = useAsyncResource(load, { failureMessage: t('No pudimos consultar el reporte.') });
  const error = fetchAttentionReport ? loadError : t('No pudimos validar tu acceso al reporte.');

  return (
    <StandalonePage
      testId="report-page"
      navStart={<PageTitle tone="muted">{t('Reporte de Atención')}</PageTitle>}
      navEnd={
        <PageNavButton
          onClick={() => window.close()}
          icon={<CloseIcon style={{ fontSize: 16 }} />}
          testId="report-page-close"
        >
          {t('Cerrar')}
        </PageNavButton>
      }
    >
      {data ? (
        <AttentionReportView data={data} />
      ) : (
        <PageMessageCard testId="report-page-empty" maxWidth={520}>
          {error || t('Cargando el reporte...')}
        </PageMessageCard>
      )}
    </StandalonePage>
  );
}
