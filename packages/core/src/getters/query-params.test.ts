import { ParameterObject } from 'openapi3-ts';
import { describe, expect, it } from 'vitest';
import { ContextSpecs } from '../types';
import { getQueryParams } from './query-params';

// Mock context for getQueryParams
const context: ContextSpecs = {
  specs: {},
  // @ts-ignore
  override: {
    useDates: true,
  },
};

const queryParams: {
  parameter: ParameterObject;
  optional: boolean;
}[] = [
  {
    parameter: {
      name: 'queryParamWithSchemaNotRequired',
      in: 'query',
      schema: {
        type: 'string',
      },
      required: false,
    },
    optional: true,
  },
  {
    parameter: {
      name: 'queryParamWithSchemaRequired',
      in: 'query',
      schema: {
        type: 'string',
      },
      required: true,
    },
    optional: false,
  },
  {
    parameter: {
      name: 'queryParamWithSchemaDefaultValue',
      in: 'query',
      schema: {
        default: 'defaultValue',
        type: 'string',
      },
    },
    optional: true,
  },
  {
    parameter: {
      name: 'queryParamWithContentNotRequired',
      in: 'query',
      content: {
        'application/json': {
          schema: {
            type: 'string',
          },
        },
      },
      required: false,
    },
    optional: true,
  },
  {
    parameter: {
      name: 'queryParamWithContentRequired',
      in: 'query',
      content: {
        'application/json': {
          schema: {
            type: 'string',
          },
        },
      },
      required: true,
    },
    optional: false,
  },
  {
    parameter: {
      name: 'queryParamWithContentDefaultValue',
      in: 'query',
      content: {
        'application/json': {
          schema: {
            default: 'defaultValue',
            type: 'string',
          },
        },
      },
      required: true,
    },
    optional: true,
  },
];

describe('getQueryParams getter', () => {
  queryParams.forEach(({ parameter, optional }) => {
    it(`${parameter.name} should${
      !optional ? ' NOT ' : ' '
    }be optional`, () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter,
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.schema.model.trim()).toBe(
        `export type Params = { ${parameter.name}${
          optional ? '?' : ''
        }: string };`,
      );
    });
  });
});
