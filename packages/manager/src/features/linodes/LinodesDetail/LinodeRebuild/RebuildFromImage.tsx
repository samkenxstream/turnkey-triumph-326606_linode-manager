import { rebuildLinode, RebuildRequest } from '@linode/api-v4/lib/linodes';
import { RebuildLinodeSchema } from '@linode/validation/lib/linodes.schema';
import { Formik, FormikProps } from 'formik';
import { useSnackbar } from 'notistack';
import { isEmpty } from 'ramda';
import * as React from 'react';
import { compose } from 'recompose';
import AccessPanel from 'src/components/AccessPanel';
import ActionsPanel from 'src/components/ActionsPanel';
import Button from 'src/components/Button';
import { makeStyles } from '@mui/styles';
import { Theme } from '@mui/material/styles';
import Grid from 'src/components/Grid';
import ImageSelect from 'src/components/ImageSelect';
import TypeToConfirm from 'src/components/TypeToConfirm';
import { resetEventsPolling } from 'src/eventsPolling';
import userSSHKeyHoc, {
  UserSSHKeyProps,
} from 'src/features/linodes/userSSHKeyHoc';
import { useAllImagesQuery } from 'src/queries/images';
import { usePreferences } from 'src/queries/preferences';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import {
  handleFieldErrors,
  handleGeneralErrors,
} from 'src/utilities/formikErrorUtils';
import scrollErrorIntoView from 'src/utilities/scrollErrorIntoView';
import { extendValidationSchema } from 'src/utilities/validatePassword';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    paddingTop: theme.spacing(3),
  },
  error: {
    marginTop: theme.spacing(2),
  },
  actionPanel: {
    flexDirection: 'column',
    '& button': {
      alignSelf: 'flex-end',
    },
  },
}));

interface Props {
  disabled: boolean;
  passwordHelperText: string;
  linodeId: number;
  linodeLabel?: string;
  handleRebuildError: (status: string) => void;
  onClose: () => void;
}

export type CombinedProps = Props & UserSSHKeyProps;

interface RebuildFromImageForm {
  image: string;
  root_pass: string;
}

const initialValues: RebuildFromImageForm = {
  image: '',
  root_pass: '',
};

export const RebuildFromImage: React.FC<CombinedProps> = (props) => {
  const {
    disabled,
    userSSHKeys,
    sshError,
    requestKeys,
    linodeId,
    linodeLabel,
    handleRebuildError,
    onClose,
    passwordHelperText,
  } = props;

  const { data: preferences } = usePreferences();

  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();

  const RebuildSchema = () => extendValidationSchema(RebuildLinodeSchema);

  const [confirmationText, setConfirmationText] = React.useState<string>('');

  const { data: _imagesData, error: imagesError } = useAllImagesQuery();

  const submitButtonDisabled =
    preferences?.type_to_confirm !== false && confirmationText !== linodeLabel;

  const handleFormSubmit = (
    { image, root_pass }: RebuildFromImageForm,
    { setSubmitting, setStatus, setErrors }: FormikProps<RebuildFromImageForm>
  ) => {
    setSubmitting(true);

    // `status` holds general error messages
    setStatus(undefined);

    const params: RebuildRequest = {
      image,
      root_pass,
      authorized_users: userSSHKeys
        .filter((u) => u.selected)
        .map((u) => u.username),
    };

    // @todo: eventually this should be a dispatched action instead of a services library call
    rebuildLinode(linodeId, params)
      .then((_) => {
        // Reset events polling since an in-progress event (rebuild) is happening.
        resetEventsPolling();

        setSubmitting(false);

        enqueueSnackbar('Linode rebuild started', {
          variant: 'info',
        });
        onClose();
      })
      .catch((errorResponse) => {
        const defaultMessage = `There was an issue rebuilding your Linode.`;
        const mapErrorToStatus = (generalError: string) =>
          setStatus({ generalError });

        setSubmitting(false);
        handleFieldErrors(setErrors, errorResponse);
        handleGeneralErrors(mapErrorToStatus, errorResponse, defaultMessage);
        scrollErrorIntoView();
      });
  };

  const _imagesError = imagesError
    ? getAPIErrorOrDefault(imagesError, 'Unable to load Images')[0].reason
    : undefined;

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={RebuildSchema}
      validateOnChange={false}
      onSubmit={handleFormSubmit}
    >
      {({
        errors,
        handleSubmit,
        setFieldValue,
        status, // holds generalError messages
        values,
        validateForm,
      }) => {
        // We'd like to validate the form before submitting.
        const handleRebuildButtonClick = () => {
          // Validate stackscript_id, image, & root_pass
          validateForm().then((maybeErrors) => {
            // If there aren't any errors, we can submit the form.
            if (isEmpty(maybeErrors)) {
              handleSubmit();
              // The form receives the errors automatically, and we scroll them into view.
            } else {
              scrollErrorIntoView();
            }
          });
        };

        if (status) {
          handleRebuildError(status.generalError);
        }

        return (
          <Grid item className={classes.root}>
            <form>
              <ImageSelect
                title="Select Image"
                images={_imagesData ?? []}
                error={_imagesError || errors.image}
                selectedImageID={values.image}
                handleSelectImage={(selected) =>
                  setFieldValue('image', selected)
                }
                disabled={disabled}
                variant="all"
                data-qa-select-image
              />
              <AccessPanel
                password={values.root_pass}
                handleChange={(input) => setFieldValue('root_pass', input)}
                updateFor={[
                  classes,
                  disabled,
                  values.root_pass,
                  errors,
                  sshError,
                  userSSHKeys,
                  values.image,
                ]}
                error={errors.root_pass}
                sshKeyError={sshError}
                users={userSSHKeys}
                requestKeys={requestKeys}
                data-qa-access-panel
                disabled={disabled}
                passwordHelperText={passwordHelperText}
              />
              <ActionsPanel className={classes.actionPanel}>
                <TypeToConfirm
                  confirmationText={
                    <span>
                      To confirm these changes, type the label of the Linode (
                      <strong>{linodeLabel}</strong>) in the field below:
                    </span>
                  }
                  title="Confirm"
                  typographyStyle={{ marginBottom: 8 }}
                  onChange={(input) => {
                    setConfirmationText(input);
                  }}
                  value={confirmationText}
                  hideLabel
                  visible={preferences?.type_to_confirm}
                  label="Linode Label"
                  textFieldStyle={{ marginBottom: 16 }}
                />
                <Button
                  disabled={submitButtonDisabled || disabled}
                  buttonType="primary"
                  onClick={handleRebuildButtonClick}
                  data-testid="rebuild-button"
                >
                  Rebuild Linode
                </Button>
              </ActionsPanel>
            </form>
          </Grid>
        );
      }}
    </Formik>
  );
};

const enhanced = compose<CombinedProps, Props>(userSSHKeyHoc);

export default enhanced(RebuildFromImage);
