import fs from 'fs';
import path from 'path';
import { toRequireContext } from '@storybook/core/server';
import registerRequireContextHook from 'babel-plugin-require-context-hook/register';
import global from 'global';
import { ClientApi } from './Loader';
import { StoryshotsOptions } from '../api/StoryshotsOptions';

registerRequireContextHook();

const isFile = (file: string): boolean => {
  try {
    return fs.lstatSync(file).isFile();
  } catch (e) {
    return false;
  }
};

interface Output {
  stories: string[];
  files: string[];
}

const supportedExtensions = ['ts', 'tsx', 'js', 'jsx'];
const supportedFilenames = ['preview', 'config'];

export const getPreviewFile = (configDir: string): string | false => {
  const allFilenames = supportedFilenames
    .flatMap(filename => supportedExtensions.map(ext => `${filename}.${ext}`))
    .map(filename => path.join(configDir, filename));

  return allFilenames.find(isFile) || false;
};

const getMainFile = (configDir: string): string | false => {
  const main = path.join(configDir, 'main.js');

  if (isFile(main)) {
    return main;
  }

  return false;
};

function getConfigPathParts(input: string): Output {
  const configDir = path.resolve(input);

  if (fs.lstatSync(configDir).isDirectory()) {
    const output: Output = { files: [], stories: [] };

    const preview = getPreviewFile(configDir);
    const main = getMainFile(configDir);

    if (preview) {
      output.files.push(preview);
    }
    if (main) {
      const { stories = [] } = require.requireActual(main);

      output.stories = stories.map(
        (pattern: string | { path: string; recursive: boolean; match: string }) => {
          const { path: basePath, recursive, match } = toRequireContext(pattern);
          // eslint-disable-next-line no-underscore-dangle
          return global.__requireContext(
            configDir,
            basePath,
            recursive,
            new RegExp(match.slice(1, -1))
          );
        }
      );
    }

    return output;
  }

  return { files: [configDir], stories: [] };
}

function configure(
  options: {
    storybook: ClientApi;
  } & StoryshotsOptions
): void {
  const { configPath = '.storybook', config, storybook } = options;

  if (config && typeof config === 'function') {
    config(storybook);
    return;
  }

  const { files, stories } = getConfigPathParts(configPath);

  files.forEach(f => {
    require.requireActual(f);
  });

  if (stories && stories.length) {
    storybook.configure(stories, false);
  }
}

export default configure;
