import { GetterBody } from './../../core/src/types';
import {
  camel,
  ClientBuilder,
  ClientDependenciesBuilder,
  ClientGeneratorsBuilder,
  ClientHeaderBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateVerbImports,
  GeneratorDependency,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
  GetterParams,
  GetterProps,
  GetterPropType,
  GetterResponse,
  isSyntheticDefaultImportsAllow,
  pascal,
  stringify,
  toObjectString,
  Verbs,
  VERBS_WITH_BODY,
} from '@orval/core';

const AXIOS_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'axios',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
      { name: 'AxiosRequestConfig' },
      { name: 'AxiosResponse' },
      { name: 'AxiosError' },
    ],
    dependency: 'axios',
  },
];

const SWR_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'useSWR', values: true, default: true },
      { name: 'SWRConfiguration' },
      { name: 'Key' },
    ],
    dependency: 'swr',
  },
  {
    exports: [
      { name: 'useSWRMutation', values: true, default: true },
      { name: 'SWRMutationConfiguration' },
    ],
    dependency: 'swr/mutation',
  },
];

export const getSwrDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator: boolean,
) => [...(!hasGlobalMutator ? AXIOS_DEPENDENCIES : []), ...SWR_DEPENDENCIES];

const generateSwrRequestFunction = (
  {
    headers,
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    formData,
    formUrlEncoded,
    override,
  }: GeneratorVerbOptions,
  { route, context }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData !== false;
  const isFormUrlEncoded = override?.formUrlEncoded !== false;
  const isExactOptionalPropertyTypes =
    !!context.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;
  const isBodyVerb = VERBS_WITH_BODY.includes(verb);
  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    context.tsconfig,
  );

  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      headers,
      queryParams,
      response,
      verb,
      isFormData,
      isFormUrlEncoded,
      hasSignal: false,
      isBodyVerb,
      isExactOptionalPropertyTypes,
    });

    const propsImplementation =
      mutator?.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(`(\\w*):\\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override?.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    return `export const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options?: SecondParameter<typeof ${mutator.name}>`
        : ''
    }) => {${bodyForm}
      return ${mutator.name}<${response.definition.success || 'unknown'}>(
      ${mutatorConfig},
      ${requestOptions});
    }
  `;
  }

  const options = generateOptions({
    route,
    body,
    headers,
    queryParams,
    response,
    verb,
    requestOptions: override?.requestOptions,
    isFormData,
    isFormUrlEncoded,
    isExactOptionalPropertyTypes,
    hasSignal: false,
  });

  return `export const ${operationName} = (\n    ${toObjectString(
    props,
    'implementation',
  )} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {${bodyForm}
    return axios${
      !isSyntheticDefaultImportsAllowed ? '.default' : ''
    }.${verb}(${options});
  }
`;
};

const generateSwrArguments = ({
  operationName,
  isMutation,
  mutator,
  isRequestOptions,
}: {
  operationName: string;
  isMutation: boolean;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
}) => {
  const configuration = isMutation
    ? 'SWRMutationConfiguration'
    : 'SWRConfiguration';
  const definition = `${configuration}<Awaited<ReturnType<typeof ${operationName}>>, TError> & { swrKey?: Key, enabled?: boolean }`;

  if (!isRequestOptions) {
    return `swrOptions?: ${definition}`;
  }

  return `options?: { swr?:${definition}, ${
    !mutator
      ? `axios?: AxiosRequestConfig`
      : mutator?.hasSecondArg
      ? `request?: SecondParameter<typeof ${mutator.name}>`
      : ''
  } }\n`;
};

const generateSwrImplementation = ({
  operationName,
  swrKeyFnName,
  swrProperties,
  swrKeyProperties,
  params,
  body,
  isMutation,
  mutator,
  isRequestOptions,
  response,
  swrOptions,
  props,
}: {
  isRequestOptions: boolean;
  operationName: string;
  swrKeyFnName: string;
  swrProperties: string;
  swrKeyProperties: string;
  isMutation: boolean;
  params: GetterParams;
  body: GetterBody;
  props: GetterProps;
  response: GetterResponse;
  mutator?: GeneratorMutator;
  swrOptions: { options?: any };
}) => {
  const swrProps = toObjectString(
    isMutation ? props.filter((p) => p.type !== GetterPropType.BODY) : props,
    'implementation',
  );
  const httpFunctionProps = swrProperties;

  const swrKeyImplementation = `const isEnabled = swrOptions?.enabled !== false${
    params.length
      ? ` && !!(${params.map(({ name }) => name).join(' && ')})`
      : ''
  }
  const swrKey = swrOptions?.swrKey ?? (() => isEnabled ? ${swrKeyFnName}(${swrKeyProperties}) : null);`;

  let errorType = `AxiosError<${response.definition.errors || 'unknown'}>`;

  if (mutator) {
    errorType = mutator.hasErrorType
      ? `ErrorType<${response.definition.errors || 'unknown'}>`
      : response.definition.errors || 'unknown';
  }

  const hasBody = props.some((prop) => prop.type === GetterPropType.BODY);

  const swrFnImplementation = `
  const swrFn = (${
    isMutation
      ? `key: Key${hasBody ? `, options: { arg: ${body.definition} }` : ''}`
      : ''
  }) => ${operationName}(${httpFunctionProps}${httpFunctionProps ? ', ' : ''}${
    isRequestOptions
      ? !mutator
        ? `axiosOptions`
        : mutator?.hasSecondArg
        ? 'requestOptions'
        : ''
      : ''
  });
  `;

  return `
export type ${pascal(operationName)}${
    isMutation ? 'Mutation' : 'Query'
  }Result = NonNullable<Awaited<ReturnType<typeof ${operationName}>>>
export type ${pascal(operationName)}${
    isMutation ? 'Mutation' : 'Query'
  }Error = ${errorType}

export const ${camel(
    `use-${operationName}`,
  )} = <TError = ${errorType}>(\n ${swrProps} ${generateSwrArguments({
    operationName,
    isMutation,
    mutator,
    isRequestOptions,
  })}\n  ) => {

  ${
    isRequestOptions
      ? `const {swr: swrOptions${
          !mutator
            ? `, axios: axiosOptions`
            : mutator?.hasSecondArg
            ? ', request: requestOptions'
            : ''
        }} = options ?? {}`
      : ''
  }

  ${swrKeyImplementation}
  ${swrFnImplementation}

  const result = ${
    isMutation ? 'useSWRMutation' : 'useSWR'
  }<Awaited<ReturnType<typeof swrFn>>, TError, Key${
    hasBody ? `, ${body.definition}` : ''
  }>(swrKey, swrFn, ${
    swrOptions.options
      ? `{
    ${stringify(swrOptions.options)?.slice(1, -1)}
    ...swrOptions
  }`
      : 'swrOptions'
  })

  return {
    swrKey,
    ...result
  }
}\n`;
};

const generateSwrHook = (
  {
    queryParams,
    operationName,
    body,
    props,
    verb,
    params,
    override,
    mutator,
    response,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;

  const isMutation = [
    Verbs.POST,
    Verbs.PUT,
    Verbs.DELETE,
    Verbs.PATCH,
  ].includes(verb);

  if (verb !== Verbs.GET && !isMutation) {
    return '';
  }

  const swrProperties = props
    .map(({ name, type }) =>
      type === GetterPropType.BODY ? 'options.arg' : name,
    )
    .join(', ');

  const swrKeyProperties = props
    .filter(
      (prop) =>
        ![GetterPropType.HEADER, GetterPropType.BODY].includes(prop.type),
    )
    .map(({ name }) => name)
    .join(', ');

  const swrKeyFnName = camel(`get-${operationName}-key`);
  const queryKeyProps = toObjectString(
    props.filter(
      (prop) =>
        ![GetterPropType.HEADER, GetterPropType.BODY].includes(prop.type),
    ),
    'implementation',
  );

  return `export const ${swrKeyFnName} = (${queryKeyProps}) => [\`${route}\`${
    queryParams ? ', ...(params ? [params]: [])' : ''
  }];

    ${generateSwrImplementation({
      operationName,
      swrKeyFnName,
      swrProperties,
      swrKeyProperties,
      params,
      body,
      props,
      isMutation,
      mutator,
      isRequestOptions,
      response,
      swrOptions: override.swr,
    })}
`;
};

export const generateSwrHeader: ClientHeaderBuilder = ({
  isRequestOptions,
  isMutator,
  hasAwaitedType,
}) =>
  `
  ${
    !hasAwaitedType
      ? `type AwaitedInput<T> = PromiseLike<T> | T;\n
      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;\n\n`
      : ''
  }
  ${
    isRequestOptions && isMutator
      ? `// eslint-disable-next-line
  type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;\n\n`
      : ''
  }`;

export const generateSwr: ClientBuilder = (verbOptions, options) => {
  const imports = generateVerbImports(verbOptions);
  const functionImplementation = generateSwrRequestFunction(
    verbOptions,
    options,
  );
  const hookImplementation = generateSwrHook(verbOptions, options);

  return {
    implementation: `${functionImplementation}\n\n${hookImplementation}`,
    imports,
  };
};

const swrClientBuilder: ClientGeneratorsBuilder = {
  client: generateSwr,
  header: generateSwrHeader,
  dependencies: getSwrDependencies,
};

export const builder = () => () => swrClientBuilder;

export default builder;
