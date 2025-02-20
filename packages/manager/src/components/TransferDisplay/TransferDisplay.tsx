import OpenInNew from '@mui/icons-material/OpenInNew';
import { DateTime } from 'luxon';
import * as React from 'react';
import BarPercent from 'src/components/BarPercent';
import Dialog from 'src/components/core/Dialog';
import { makeStyles } from '@mui/styles';
import { Theme } from '@mui/material/styles';
import Typography from 'src/components/core/Typography';
import Grid from 'src/components/Grid';
import Link from 'src/components/Link';
import { useAccountTransfer } from 'src/queries/accountTransfer';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    width: '100%',
    margin: 'auto',
    textAlign: 'center',
    [theme.breakpoints.down('md')]: {
      width: '85%',
    },
  },
  poolUsageProgress: {
    marginBottom: theme.spacing(0.5),
    '& .MuiLinearProgress-root': {
      borderRadius: 1,
    },
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    flexFlow: 'row nowrap',
    marginTop: theme.spacing(1),
    '& p': {
      marginRight: 4,
    },
    '& svg': {
      width: 15,
      height: 15,
      color: theme.palette.text.primary,
      '&:hover': {
        color: 'inherit',
      },
    },
  },
  paper: {
    padding: theme.spacing(3),
  },
  proratedNotice: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  openModalButton: {
    ...theme.applyLinkStyles,
  },
}));

export interface Props {
  spacingTop?: number;
}

export const TransferDisplay = ({ spacingTop }: Props) => {
  const classes = useStyles();

  const [modalOpen, setModalOpen] = React.useState(false);
  const { data, isLoading, isError } = useAccountTransfer();
  const quota = data?.quota ?? 0;
  const used = data?.used ?? 0;

  const poolUsagePct = used < quota ? (used / quota) * 100 : 100;

  if (isError) {
    // We may want to add an error state for this but I think that would clutter
    // up the display.
    return null;
  }

  return (
    <>
      <Typography
        className={classes.root}
        style={{ marginTop: spacingTop ?? 8 }}
      >
        {isLoading ? (
          'Loading transfer data...'
        ) : (
          <>
            You have used {poolUsagePct.toFixed(poolUsagePct < 1 ? 2 : 0)}% of
            your
            {`  `}
            <button
              className={classes.openModalButton}
              onClick={() => setModalOpen(true)}
            >
              Monthly Network Transfer Pool
            </button>
            .
          </>
        )}
      </Typography>
      <TransferDialog
        isOpen={modalOpen}
        used={used}
        quota={quota}
        poolUsagePct={poolUsagePct}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};

export const getDaysRemaining = () =>
  Math.floor(
    DateTime.local()
      .setZone('America/New_York')
      .endOf('month')
      .diffNow('days')
      .toObject().days ?? 0
  );

export default React.memo(TransferDisplay);

// =============================================================================
// Dialog
// =============================================================================
interface DialogProps {
  isOpen: boolean;
  used: number;
  quota: number;
  poolUsagePct: number;
  onClose: () => void;
}

export const TransferDialog = React.memo((props: DialogProps) => {
  const { isOpen, onClose, poolUsagePct, quota, used } = props;
  const classes = useStyles();
  const daysRemainingInMonth = getDaysRemaining();

  return (
    <Dialog
      open={isOpen}
      classes={{ paper: classes.paper }}
      onClose={onClose}
      title="Monthly Network Transfer Pool"
      maxWidth="sm"
    >
      <Grid
        container
        justifyContent="space-between"
        style={{ marginBottom: 0 }}
      >
        <Grid item style={{ marginRight: 10 }}>
          <Typography>{used} GB Used</Typography>
        </Grid>
        <Grid item>
          <Typography>
            {quota >= used ? (
              <span>{quota - used} GB Available</span>
            ) : (
              <span>
                {(quota - used).toString().replace(/\-/, '')} GB Over Quota
              </span>
            )}
          </Typography>
        </Grid>
      </Grid>
      <BarPercent
        max={100}
        value={Math.ceil(poolUsagePct)}
        className={classes.poolUsageProgress}
        rounded
      />

      <Typography className={classes.proratedNotice}>
        <strong>
          Your account&rsquo;s monthly network transfer allotment will reset in{' '}
          {daysRemainingInMonth} days.
        </strong>
      </Typography>
      <Typography className={classes.proratedNotice}>
        Your account&rsquo;s network transfer pool adds up all the included
        transfer associated with the active Linode services on your account, and
        is prorated based on service creation and deletion dates.
      </Typography>
      <div className={classes.link}>
        <Typography>
          Optimize your network usage and avoid billing surprises related to
          network transfer.
        </Typography>
        <Link to="https://www.linode.com/docs/guides/network-transfer-quota/">
          <OpenInNew />
        </Link>
      </div>
    </Dialog>
  );
});
