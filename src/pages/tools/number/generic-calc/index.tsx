{variable.alternates?.map((alt) => (
                              <Box key={alt.title}>
                                <Stack
                                  direction="row"
                                  spacing={2}
                                  alignItems="center"
                                >
                                  <Typography sx={{ minWidth: '8%' }}>
                                    {alt.title}
                                  </Typography>
                                  <Box sx={{ flexGrow: 1 }}>
                                    <NumericInputWithUnit
                                      key={alt.title}
                                      defaultPrefix={alt.defaultPrefix || ''}
                                      value={{
                                        value:
                                          getAlternate(
                                            alt,
                                            variable,
                                            values.vars[variable.name]
                                          ) || NaN,
                                        unit: alt.unit || ''
                                      }}
                                      disabled={
                                        values.outputVariable ===
                                          variable.name ||
                                        valsBoundToPreset[variable.name] !==
                                          undefined
                                      }
                                      disableChangingUnit={
                                        valsBoundToPreset[variable.name] !==
                                        undefined
                                      }
                                      onOwnChange={(val) =>
                                        updateVarField(
                                          variable.name,
                                          getMainFromAlternate(
                                            alt,
                                            variable,
                                            val
                                          ),
                                          variable.unit,
                                          values,
                                          updateField
                                        )
                                      }
                                    />
                                  </Box>
                                </Stack>
                              </Box>
                            ))}
