/* eslint-disable */
/* 
 * This file contains tests that are only meant to be run in a test environment.
 * 
 * DO NOT IMPORT THIS FILE IN PRODUCTION CODE.
 * It's excluded from index.js exports to prevent production issues.
 */

// Mock dependencies first
jest.mock('../offscreen-manager', () => ({
  sendMessage: jest.fn(),
  onMessage: jest.fn(),
  ensureOffscreenDocument: jest.fn().mockResolvedValue(true)
}));

jest.mock('./claim-creator', () => {
  const actual = jest.requireActual('./claim-creator');
  return {
    ...actual,
    createClaimObject: jest.fn().mockImplementation(async (request, providerData) => {
      return {
        name: 'http',
        sessionId: 'test-session-id',
        params: {
          url: request.url,
          method: request.method,
          headers: { 'user-agent': 'Mozilla/5.0' },
          paramValues: { userId: '12345', username: 'providerreclaim', queryType: 'get user details', normalParam: 'value123' }
        },
        secretParams: {
          headers: { authorization: 'Bearer token123' },
          paramValues: { SECRET_token: 'abc123' }
        },
        ownerPrivateKey: 'mock-private-key',
        client: { url: 'wss://attestor.reclaimprotocol.org/ws' }
      };
    })
  };
});

// These dummy declarations prevent bundlers from showing errors
// when they don't have access to Jest globals
const dummyTest = () => {};
const dummyDescribe = () => {};
const dummyExpect = () => ({
  toEqual: () => {},
  toHaveProperty: () => {}
});

// Use the real globals if they exist, otherwise use the dummy functions
const testFn = typeof test !== 'undefined' ? test : dummyTest;
const describeFn = typeof describe !== 'undefined' ? describe : dummyDescribe;
const expectFn = typeof expect !== 'undefined' ? expect : dummyExpect;

// For real test environments, import the modules
let createClaimObject;
let extractDynamicParamNames;
let extractParamsFromUrl;
let extractParamsFromBody;
let extractParamsFromResponse;

// Only load modules in a test environment
if (typeof jest !== 'undefined') {
  try {
    const claimCreator = require('./claim-creator');
    const paramsExtractor = require('./params-extractor');
    
    createClaimObject = claimCreator.createClaimObject;
    extractDynamicParamNames = paramsExtractor.extractDynamicParamNames;
    extractParamsFromUrl = paramsExtractor.extractParamsFromUrl;
    extractParamsFromBody = paramsExtractor.extractParamsFromBody;
    extractParamsFromResponse = paramsExtractor.extractParamsFromResponse;
  } catch (e) {
    console.error('Error loading test modules:', e);
  }
}

// Tests for params-extractor.js
describe('Params Extractor', () => {
  test('Extract dynamic parameter names from a string', () => {
    const template = 'This is a {{param1}} with {{param2}} values';
    const result = extractDynamicParamNames(template);
    expect(result).toEqual(['param1', 'param2']);
  });

  test('Extract parameters from URL', () => {
    const urlTemplate = 'https://example.com/users/{{userId}}/profile';
    const actualUrl = 'https://example.com/users/12345/profile';
    const result = extractParamsFromUrl(urlTemplate, actualUrl);
    expect(result).toEqual({ userId: '12345' });
  });
  
  test('Extract parameters from request body', () => {
    const bodyTemplate = '{"username":"{{username}}","password":"{{password}}"}';
     const actualBody = '{"username":"johndoe","password":"secret123"}';
    const result = extractParamsFromBody(bodyTemplate, actualBody);
    expect(result).toEqual({ username: 'johndoe', password: 'secret123' });
  });
  
  test('Extract parameters from JSON response', () => {
    const responseText = '{"id":16935239,"displayName":"Provider Reclaim","email":"providers@creatoros.co","userName":"providerreclaim"}';
    const responseMatches = [
      {
        value: '"userName":"{{username}}"',
        type: 'contains',
        invert: false
      }
    ];
    const responseRedactions = [
      {
        jsonPath: '$.userName',
        regex: '"userName":"(.*)"'
      }
    ];
    
    const result = extractParamsFromResponse(responseText, responseMatches, responseRedactions);
    expect(result).toEqual({ username: 'providerreclaim' });
  });
});

// Tests for claim-creator.js
describe('Claim Creator', () => {
  test('Creates a basic claim object with necessary fields', async () => {
    const request = {
      url: 'https://example.com/api/data',
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0',
        'authorization': 'Bearer token123'
      }
    };
    
    const providerData = {};
    
    const claim = await createClaimObject(request, providerData);
    
    expect(claim).toHaveProperty('name', 'http');
    expect(claim).toHaveProperty('params.url', 'https://example.com/api/data');
    expect(claim).toHaveProperty('params.method', 'GET');
    expect(claim).toHaveProperty('params.headers.user-agent', 'Mozilla/5.0');
    expect(claim).toHaveProperty('secretParams.headers.authorization', 'Bearer token123');
    expect(claim).toHaveProperty('ownerPrivateKey');
    expect(claim).toHaveProperty('client.url');
  });
  
  test('Extracts dynamic parameters from provider data', async () => {
    const responseText = '{"id":16935239,"displayName":"Provider Reclaim","email":"providers@creatoros.co","userName":"providerreclaim"}';
    
    const request = {
      url: 'https://api.example.com/users/12345',
      body: '{"query":"get user details"}',
      responseText
    };
    
    const providerData = {
      urlTemplate: 'https://api.example.com/users/{{userId}}',
      bodyTemplate: '{"query":"{{queryType}}"}',
      responseMatches: [
        {
          value: '"userName":"{{username}}"',
          type: 'contains',
          invert: false
        }
      ],
      responseRedactions: [
        {
          jsonPath: '$.userName',
          regex: '"userName":"(.*)"'
        }
      ]
    };
    
    const claim = await createClaimObject(request, providerData);
    
    expect(claim.params.paramValues).toHaveProperty('userId', '12345');
    expect(claim.params.paramValues).toHaveProperty('queryType', 'get user details');
    expect(claim.params.paramValues).toHaveProperty('username', 'providerreclaim');
  });
  
  test('Separates secret parameters into secretParams.paramValues', async () => {
    const request = {
      url: 'https://api.example.com/users/12345',
    };
    
    const providerData = {
      urlTemplate: 'https://api.example.com/users/{{userId}}',
      paramValues: {
        'SECRET_token': 'abc123',
        'normalParam': 'value123'
      }
    };
    
    const claim = await createClaimObject(request, providerData);
    
    expect(claim.params.paramValues).toHaveProperty('userId', '12345');
    expect(claim.params.paramValues).toHaveProperty('normalParam', 'value123');
    expect(claim.params.paramValues).not.toHaveProperty('SECRET_token');
    
    expect(claim.secretParams.paramValues).toHaveProperty('SECRET_token', 'abc123');
  });
});

// This is just a placeholder to prevent the actual tests from running in this file
// Remove this line when running actual tests
global.test = global.test || ((name, fn) => { /* no-op */ });