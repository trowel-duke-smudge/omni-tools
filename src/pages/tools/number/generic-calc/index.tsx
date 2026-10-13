import {
  Autocomplete,
  Box,
  MenuItem,
  Radio,
  Select,
  Stack,
  TextField,
  useTheme
} from '@mui/material';
import React, { useContext, useState } from 'react';
import ToolContent from '@components/ToolContent';
import { ToolComponentProps } from '@tools/defineTool';
import NumericInputWithUnit from '@components/input/NumericInputWithUnit';
import { UpdateField } from '@components/options/ToolOptions';
import { InitialValuesType } from './types';
import type { AlternativeVarInfo, GenericCalcType } from './data/types';
import { dataTableLookup } from 'datatables';

import nerdamer from 'nerdamer-prime';
import 'nerdamer-prime/Algebra';
import 'nerdamer-prime/Solve';
import 'nerdamer-prime/Calculus';
import Qty from 'js-quantities';
import { CustomSnackBarContext } from 'contexts/CustomSnackBarContext';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { validNamespaces } from '../../../../i18n';

function numericSolveEquationFor(
  equation: string,
  varName: string,
  variables: { [key: string]: number }
) {
  let expr = nerdamer(equation);
  for (const key in variables) {
    expr = expr.sub(key, variables[key].toString());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any = expr.solveFor(varName);

  // Sometimes the result is an array, check for it while keeping linter happy
  if (result.toDecimal === undefined) {
    result = result[0];
  }

  return parseFloat(result.evaluate().toDecimal());
}

export default async function makeTool(
  calcData: GenericCalcType
): Promise<React.JSXElementConstructor<ToolComponentProps>> {
  const initialValues: InitialValuesType = {
    outputVariable: '',
    vars: {},
    presets: {}
  };

  return function GenericCalc({ title }: ToolComponentProps) {
    const { showSnackBar } = useContext(CustomSnackBarContext);
    const { t } = useTranslation(validNamespaces);
    const theme = useTheme();
    const lessThanSmall = useMediaQuery(theme.breakpoints.down('sm'));

    // For UX purposes we need to track what vars are
    const [valsBoundToPreset, setValsBoundToPreset] = useState<{
      [key: string]: string;
    }>({});

    const [extraOutputs, setExtraOutputs] = useState<{
      [key: string]: number;
    }>({});

    const updateVarField = (
      name: string,
      value: number,
      unit: string,
      values: InitialValuesType,
      updateFieldFunc: UpdateField<InitialValuesType>
    ) => {
      // Make copy
      const newVars = { ...values.vars };
      newVars[name] = {
        value,
        unit: unit
      };
      updateFieldFunc('vars', newVars);
    };

    const handleSelectedTargetChange = (
      varName: string,
      updateFieldFunc: UpdateField<InitialValuesType>
    ) => {
      updateFieldFunc('outputVariable', varName);
    };

    const handleSelectedPresetChange = (
      selection: string,
      preset: string,
      currentValues: InitialValuesType,
      updateFieldFunc: UpdateField<InitialValuesType>
    ) => {
      const newPresets = { ...currentValues.presets };
      newPresets[selection] = preset;
      updateFieldFunc('presets', newPresets);

      // Clear old selection using setState callback pattern
      setValsBoundToPreset((prevState) => {
        const newState = { ...prevState };
        // Remove all keys bound to this selection
        Object.keys(newState).forEach((key) => {
          if (newState[key] === selection) {
            delete newState[key];
          }
        });
        return newState;
      });

      const selectionData = calcData.presets?.find(
        (sel) => sel.title === selection
      );

      if (preset && preset != '<custom>') {
        if (selectionData) {
          // Create an object with the new bindings
          const newBindings: { [key: string]: string } = {};

          for (const key in selectionData.bind) {
            // Add to newBindings for later state update
            newBindings[key] = selection;

            if (currentValues.outputVariable === key) {
              handleSelectedTargetChange('', updateFieldFunc);
            }

            updateVarField(
              key,

              dataTableLookup(selectionData.source, preset)[
                selectionData.bind[key]
              ],

              selectionData.source.columns[selectionData.bind[key]]?.unit || '',
              currentValues,
              updateFieldFunc
            );
          }

          // Update state with new bindings
          setValsBoundToPreset((prevState) => ({
            ...prevState,
            ...newBindings
          }));
        } else {
          throw new Error(
            `Preset "${preset}" is not valid for selection "${selection}"`
          );
        }
      }
    };

    calcData.variables.forEach((variable) => {
      if (variable.solvable === undefined) {
        variable.solvable = true;
      }
      if (variable.default === undefined) {
        initialValues.vars[variable.name] = {
          value: NaN,
          unit: variable.unit
        };
        initialValues.outputVariable = variable.name;
      } else {
        initialValues.vars[variable.name] = {
          value: variable.default || 0,
          unit: variable.unit
        };
      }
    });

    calcData.presets?.forEach((selection) => {
      initialValues.presets[selection.title] = selection.default;
      if (selection.default == '<custom>') return;
      for (const key in selection.bind) {
        initialValues.vars[key] = {
          value: dataTableLookup(selection.source, selection.default)[
            selection.bind[key]
          ],

          unit: selection.source.columns[selection.bind[key]]?.unit || ''
        };
        // We'll set this in useEffect instead of directly modifying state
      }
    });

    function getAlternate(
      alternateInfo: AlternativeVarInfo,
      mainInfo: GenericCalcType['variables'][number],
      mainValue: {
        value: number;
        unit: string;
      }
    ) {
      if (isNaN(mainValue.value)) return NaN;
      const canonicalValue = Qty(mainValue.value, mainValue.unit).to(
        mainInfo.unit
      ).scalar;

      return numericSolveEquationFor(alternateInfo.formula, 'x', {
        v: canonicalValue
      });
    }

    function getMainFromAlternate(
      alternateInfo: AlternativeVarInfo,
      mainInfo: GenericCalcType['variables'][number],
      alternateValue: {
        value: number;
        unit: string;
      }
    ) {
      if (isNaN(alternateValue.value)) return NaN;
      const canonicalValue = Qty(alternateValue.value, alternateValue.unit).to(
        alternateInfo.unit
      ).scalar;

      return numericSolveEquationFor(alternateInfo.formula, 'v', {
        x: canonicalValue
      });
    }

    return (
      <ToolContent
        title={title}
        inputComponent={null}
        initialValues={initialValues}
        toolInfo={{
          title: t(calcData.i18n.name),
          description: calcData.i18n.longDescription
            ? t(calcData.i18n.longDescription)
            : undefined
        }}
        verticalGroups
        // @ts-ignore
        getGroups={({ values, updateField }) => [
          ...(calcData.presets?.length
            ? [
                {
                  title: 'Presets',
                  component: (
                    <Grid container spacing={2} maxWidth={500}>
                      {calcData.presets?.map((preset) => (
                        <Grid item xs={12} key={preset.title}>
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={2}
                            alignItems={'center'}
                            justifyContent={'space-between'}
                          >
                            <Typography>{preset.title}</Typography>
                            <Autocomplete
                              disablePortal
                              id="combo-box-demo"
                              value={values.presets[preset.title]}
                              options={[
                                '<custom>',
                                ...Object.keys(preset.source.data).sort()
                              ]}
                              sx={{ width: '80%' }}
                              onChange={(event, newValue) => {
                                handleSelectedPresetChange(
                                  preset.title,
                                  newValue || '',
                                  values,
                                  updateField
                                );
                              }}
                              renderInput={(params) => (
                                <TextField {...params} label="Preset" />
                              )}
                            />
                          </Stack>
                        </Grid>
                      ))}
                    </Grid>
                  )
                }
              ]
            : []),
          {
            title: 'Variables',
            component: (
              <Box>
                {lessThanSmall ? (
                  <Stack
                    direction={'column'}
                    spacing={2}
                    alignItems={'center'}
                    justifyContent={'space-between'}
                  >
                    <Typography>Solve for</Typography>
                    <Select
                      sx={{ width: '80%' }}
                      fullWidth
                      value={values.outputVariable}
                      onChange={(event) =>
                        handleSelectedTargetChange(
                          event.target.value,
