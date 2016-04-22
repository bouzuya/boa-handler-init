// HTTP request -> HttpRequestAction
// HTTPResponseAction -> HTTP response

import { A, O, Handler } from 'boa-core';
import { create, HTML } from 'boa-vdom';
import { init as makeRouter, Route } from 'boa-router';
import * as express from 'express';
import { _do } from 'rxjs/operator/do';
import { filter } from 'rxjs/operator/filter';
import { share } from 'rxjs/operator/share';

const runServer = (
  dir: string,
  middlewares: any[],
  port: number,
  proc: (request: any, response: any) => void
) => {
  const app = express();
  middlewares.forEach(middleware => {
    app.use(middleware);
  });
  app.use(express.static(dir)); // TODO: if dir is null
  app.use(proc);
  app.listen(port); // TODO: if port is null
};

const makeRender = HTML.init;

type HTTPOptions = {
  dir: string;
  middlewares: any[];
  port: number;
  render: (state: any, options: any) => any;
  routes: Route[];
  httpRequestActionType?: string;
  httpResponseActionType?: string;
};

export interface InitResponse {
  handler: Handler;
}

const init = (options: HTTPOptions): InitResponse => {
  const {
    dir,
    middlewares,
    port,
    render,
    routes,
    httpRequestActionType,
    httpResponseActionType
  } = options;
  const http = makeRouter(routes);
  const httpRequestType = httpRequestActionType
    ? httpRequestActionType
    : 'http-request';
  const httpResponseType = httpResponseActionType
    ? httpResponseActionType
    : 'http-response';
  const handler = (action$: O<A<any>>, options: any): O<A<any>> => {
    const { re } = options;
    let start = false;
    let renderToHTML = makeRender();
    return share.call(
      filter.call(
        _do.call(
          filter.call(
            _do.call(
              action$,
              () => {
                if (!start) {
                  start = true;
                  const proc = (request: any, response: any) => {
                    const { route, params } = http(request.path);
                    re({
                      type: httpRequestType,
                      data: { route, params, http: { request, response } }
                    });
                  };
                  setTimeout(() => runServer(dir, middlewares, port, proc), 0);
                }
              }
            ),
            (action: A<any>): boolean => action.type === httpResponseType
          ),
          ({ data: { error, state, http: { response } } }) => {
            if (error && error.message === 'redirect') {
              const { status, path } = error;
              response.redirect(status, path);
            } else if (error) {
              const { status, path } = error;
              response.send(error.message);
            } else {
              const vtree = render(state, { create, e: (): void => null });
              const rendered = renderToHTML(vtree);
              const { result: html } = rendered;
              renderToHTML = rendered.render;
              response.send(html);
            }
          }
        ),
        () => false
      )
    );
  };
  return { handler };
};

export { init };
