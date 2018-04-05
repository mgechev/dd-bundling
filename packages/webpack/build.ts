import { Graph } from '../common/interfaces';
import { cluster } from '@mlx/cluster';
import { ClusteringAlgorithm, Cluster, Clusters, Module } from './declarations';

export interface ClusterChunksConfig {
  debug?: boolean;
  moduleGraph: Graph;
  modules: Module[];
  algorithm: ClusteringAlgorithm;
  minChunks: number;
}

export class ClusterChunksPlugin {
  private _clusters: Clusters;
  private _debug: boolean;

  constructor(config: ClusterChunksConfig) {
    this._debug = !!config.debug;
    const minChunks = config.minChunks || Math.ceil(config.modules.length * 0.15);
    if (config.algorithm) {
      this._clusters = config.algorithm(config.moduleGraph, config.modules, minChunks);
    } else {
      this._clusters = cluster(config.moduleGraph, config.modules, minChunks);
    }
    this._debug && console.debug('Clusters', this._clusters);
  }

  apply(compiler: any) {
    const valid = (a: any) => a.blocks && a.blocks[0] && a.blocks[0].dependencies && a.blocks[0].dependencies[0];

    const inSameCluster = (a: any, b: any) => {
      if (!valid(a) || !valid(b)) {
        return false;
      }
      const fileA = a.blocks[0].dependencies[0].module.userRequest;
      const fileB = b.blocks[0].dependencies[0].module.userRequest;
      for (const c of this._clusters) {
        if (c.indexOf(fileA) >= 0 && c.indexOf(fileB) >= 0) {
          this._debug && console.debug('Merging', fileA, fileB);
          return true;
        }
      }
      return false;
    };

    compiler.plugin('compilation', (compilation: any) => {
      compilation.plugin('optimize-chunks', (chunks: any) => {
        const allFilesFromChunks = [].concat.apply([], this._clusters);
        for (const a of chunks) {
          if (valid(a)) {
            let found = false;
            allFilesFromChunks.forEach((f: string) => {
              if (f === a.blocks[0].dependencies[0].module.userRequest) {
                found = true;
              }
            });
            if (!found) {
              this._debug && console.debug('Not found in clusters', a.blocks[0].dependencies[0].module.userRequest);
            }
          }
        }
        for (let i = 0; i < chunks.length - 1; i += 1) {
          const a = chunks[i];
          for (let j = i + 1; j < chunks.length; j += 1) {
            const b = chunks[j];
            if (inSameCluster(a, b)) {
              if (a.integrate(b, 'cluster-chunks')) {
                chunks.splice(j--, 1);
                this._debug && console.debug('Merged chunks. Total: ', chunks.length);
              } else {
                this._debug && console.debug('Unable to integrate chunks');
              }
            }
          }
        }
      });
    });
  }
}
