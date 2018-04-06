(function(history, basePath, graph, thresholds) {
  const preFetched = {};
  const polyfillConnection = {
    effectiveType: '3g'
  };

  const support = function support(feature){
    const fakeLink = document.createElement('link');
    try {
      if (fakeLink.relList && typeof fakeLink.relList.supports === 'function') {
        return fakeLink.relList.supports(feature);
      }
    } catch (err){
      return false;
    }
  };

  const linkPrefetchStrategy = url => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'prefetch');
    link.setAttribute('href', url);
    const parentElement = document.getElementsByTagName('head')[0] || document.getElementsByName('script')[0].parentNode;
    parentElement.appendChild(link);
  };

  const importPrefetchStrategy = url => import(url);

  const supportedPrefetchStrategy = support('prefetch') ? linkPrefetchStrategy : importPrefetchStrategy;

  const prefetch = url => {
    url = basePath + url;
    console.log('Pre-fetching', url);
    preFetched[url] = true;
    supportedPrefetchStrategy(url);
  };

  const matchRoute = (route, declaration) => {
    const routeParts = route.split('/');
    const declarationParts = declaration.split('/');
    if (routeParts.length > 0 && routeParts[routeParts.length - 1] === '') {
      routeParts.pop();
    }

    if (declarationParts.length > 0 && declarationParts[declarationParts.length - 1] === '') {
      declarationParts.pop();
    }

    if (routeParts.length !== declarationParts.length) {
      return false;
    } else {
      return declarationParts.reduce((a, p, i) => {
        if (p.startsWith(':')) {
          return a;
        }
        return a && p === routeParts[i];
      }, true);
    }
  };

  const handleNavigationChange = route => {
    const current = Object.keys(graph)
      .filter(matchRoute.bind(null, route))
      .pop();
    if (!current) {
      return;
    }
    const c = navigator.connection || polyfillConnection;
    for (const route of graph[current]) {
      if (route.probability < thresholds[c.effectiveType] || preFetched[route.chunk]) {
        continue;
      }
      if (route.chunk) {
        prefetch(route.chunk);
      }
    }
  };

  window.addEventListener('popstate', e => handleNavigationChange(location.pathname));

  const pushState = history.pushState;
  history.pushState = function(state) {
    if (typeof history.onpushstate == 'function') {
      history.onpushstate({ state: state });
    }
    handleNavigationChange(arguments[2]);
    return pushState.apply(history, arguments);
  };
})(window.history, '<%= BASE_PATH %>', <%= GRAPH %>, <%= THRESHOLDS %>);
