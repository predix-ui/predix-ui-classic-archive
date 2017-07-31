// @flow

(function() {
  'use strict';

  /* Ensures the behavior namespace is created */
  const PxAppBehavior = window.PxAppBehavior = (window.PxAppBehavior || {});

  interface AssetGraphBehaviorInterface {
    properties: *;
    items?: Array<Object>;
    keys?: {
      id?: string,
      label?: string,
      children?: string,
      route?: string,
      icon?: string,
    };
    _assetGraph?: AssetGraph | null;
    _createAssetGraph?: Object;
  }

  /**
   *
   *
   * @polymerBehavior PxAppBehavior.AssetGraph
   */
  const AssetGraphBehavior: AssetGraphBehaviorInterface = {
    properties: {
      /**
       * An array of objects that will be used to build the nav. Top-level items
       * can optionally have one level of children beneath them, turning the
       * top-level item into a dropdown group.
       *
       * Selecting an item automatically selects its parent if it has one.
       * For the navigation, top-level items with children cannot be selected
       * directly - instead, users can select a child item and its parent will
       * also be marked as selected (and set as the `selectedItemParent`).
       *
       * All items should have at least the following properties:
       *
       * - {String} id - A unique string that identifies the item. Should only
       * contain valid ASCII characters. Its recommended to only use URI-safe
       * characters to allow for easy binding to the URL. Examples: 'home' or 'alerts'
       * - {String} label - A short, human-readable text label for the item.
       *
       * The following optional properties can be used:
       *
       * - {Array} children - An array of subitem objects that are children of
       * the item. Each child item should also have an `id` and `label`, and
       * may have its own child items.
       *
       * The following is an example of a list of valid nav items:
       *
       *     [
       *       { "label" : "Home",   "id" : "home" },
       *       { "label" : "Alerts", "id" : "alerts" },
       *       { "label" : "Assets", "id" : "assets", "children": [
       *         { "label" : "Asset #1", "id" : "a1" },
       *         { "label" : "Asset #2", "id" : "a2" }
       *       ] }
       *     ]
       *
       * The item property names can be changed, e.g. to choose a different item
       * property to serve as a unique ID. See the `keys` property for details.
       */
      items: {
        type: Array
      },

      /**
       * Changes the item properties (keys) that will be used internally to find
       * each item's unique ID, label, and child list.
       *
       * Use this property if you already have a predefined data schema for your
       * application and want to customize this component to match your schema.
       * Otherwise, its recommended to leave the defaults.
       *
       * The following properties can be set:
       *
       * - id: [default='id'] a unique ID for the item
       * - label: [default='label'] a human-readable label
       * - children: [default='children'] an array of child items
       *
       * If you want to configure any keys, you must set all the keys. If any
       * of the keys are not defined, the navigation will fail.
       *
       * For example, the schema could be changed to the following:
       *
       *     {
       *       "id" : "assetId",
       *       "label" : "assetName",
       *       "children" : "subAssets"
       *     }
       *
       */
      keys: {
        type: Object,
        value: function() {
          return {
            'id' : 'id',
            'label' : 'label',
            'children' : 'children',
            'route' : 'route',
            'icon' : 'icon'
          }
        }
      }
    },

    observers: [
      '_handleAssetsChanged(items, items.*, keys, keys.*)'
    ],

    created() {
      this._assetGraph = null;
      this._createAssetGraph = PxApp.assetGraph.bind(this);
    },

    _handleAssetsChanged(items: Array<Object>, itemsRef: Object, keys: { id?: string, label?: string, children?: string, route?: string }, keysRef: Object): AssetGraph | typeof undefined {
      if (this._assetGraph === null && typeof items === 'object' && Array.isArray(items)) {
        this._assetGraph = this._createAssetGraph();
        this._assetGraph.addChildren(null, items, {
          recursive: true,
          childrenKey: this.keys.children
        });
        this.fire('px-app-asset-graph-created', {graph:this._assetGraph});
        return this._assetGraph;
      }
    },

    addChildren(node, children, options) {
      this._assetGraph.addChildren(node, children, options);
      this.fire('px-app-asset-children-updated', this._assetGraph.getInfo(node));
    }
  };
  PxAppBehavior.AssetGraph = AssetGraphBehavior;

  type AssetNodeInfo = {
    item: Object | null,
    parent: Object | null,
    siblings: Array<Object> | null,
    children: Array<Object> | null,
    path: Array<Object> | null,
    route: Array<string|null> | null,
    hasChildren: boolean | null,
    isTerminal: boolean | null,
    isExhausted: boolean | null
  }

  type AssetGraphKeys = {
    id?: string,
    children?: string
  }

  class AssetGraph {
    _options: Object;
    _tree: SymbolTree;
    _rootNode: { ROOT: boolean };
    _defaultKeys: {
      id: string,
      children: string
    };
    _symbol: Symbol;

    constructor(options?: {}) {
      /* Save options  */
      this._options = {};

      /* Add default keys */
      this._defaultKeys = {
        id: 'id',
        children: 'children'
      };

      /* Initialize SymbolTree and prepare its root node */
      this._tree = new SymbolTree();
      this._rootNode = { ROOT : true };
      this._symbol = Symbol('AssetGraph data');
    }

    _node(object: Object): { isExhausted: boolean | null, isTerminal: boolean | null } {
      const node = object[this._symbol];

      if (node) {
        return node;
      }
      else {
        return (object[this._symbol] = { isExhausted: null, isTerminal: null });
      }
    }

    _getKey(key: 'id' | 'children', val?: string) {
      return (val && typeof val === 'string' && val.length) ? val : this._defaultKeys[key];
    }

    /**
     * Checks if the node is in the graph.
     *
     * @param  {Object} node
     * @return {boolean}
     */
    hasNode(node: Object): boolean {
      if (this._tree.index(node) > -1) {
        return true;
      }
      return false;
    }

    getInfo(node: Object, routeKey?: string): AssetNodeInfo | null {
      if (this._tree.index(node) > -1) {
        const _routeKey = this._getKey('id', routeKey);
        const path = this.getPath(node);
        const route = path ? AssetGraph.pathToRoute(path, _routeKey) : null;
        const parent = this.getParent(node);
        const siblings = this.getSiblings(node);
        const children = this.getChildren(node);
        const hasChildren = (typeof children === 'object' && Array.isArray(children) && children.length > 0);
        const isTerminal = this.isTerminal(node);
        const isExhausted = this.isExhausted(node);

        return {
          item: node,
          path: path,
          route: route,
          parent: parent,
          siblings: siblings,
          children: children,
          hasChildren: hasChildren,
          isTerminal: isTerminal,
          isExhausted: isExhausted
        };

      }
      return null;
    }

    /**
     * Returns a reference to the node's parent. If the node has no parent or is
     * not in the graph, returns null.
     *
     * @param  {Object} node
     * @return {Object|null}
     */
    getParent(node: Object | null): Object | null {
      if (node && this._tree.index(node) > -1) {
        const parent = this._tree.parent(node);
        return parent !== this._rootNode ? parent : null;
      }
      return null;
    }

    /**
     * This method returns whether or not the passed in item as any siblings.
     * @param {Object} node
     */
    hasSiblings(node) {
      var siblings = this.getSiblings(node);
      return siblings && siblings.length > 1;
    }

    /**
     * Returns a reference to the node's siblings (the children of its parent).
     * The returned array includes the node.
     *
     * @param  {Object} node
     * @return {Array<Object>|null}
     */
    getSiblings(node: Object | null): Array<Object> | null {
      if (node && this._tree.index(node) > -1) {
        return this._tree.childrenToArray(this._tree.parent(node));
      }
      return null;
    }

    /**
     * Returns an array of ancestor nodes from the root of the graph to the requested
     * node. The returned array includes the node.
     *
     * @param  {Object} node
     * @return {Array<Object>|null}
     */
    getPath(node: Object | null): Array<Object> | null {
      if (node && this._tree.index(node) > -1) {
        // reverse so its root->node, slice to remove the virtual root node
        return this._tree.ancestorsToArray(node).reverse().slice(1);
      }
      return null;
    }

    /**
     * Returns an array of unique IDs for each ancestor of the requested node
     * starting at the root of the graph and ending with the requested node.
     *
     * @param  {Object} node
     * @return {Array<string>|null}
     */
    getRoute(node: Object | null, routeKey?: string): Array<string|null> | null {
      if (node && this._tree.index(node) > -1) {
        const _routeKey = typeof routeKey === 'string' && routeKey.length ? routeKey : this._defaultKeys.id;
        const ancestors = this.getPath(node);
        // if (!ancestors) return null;
        // const path = [];
        // for (let i=0; i<ancestors.length; i++) {
        //   path.push(typeof ancestors[i][_routeKey] === 'string' && ancestors[i][_routeKey].length ? ancestors[i][_routeKey] : null);
        // }
        // return path;
        return ancestors ? AssetGraph.pathToRoute(ancestors, _routeKey) : null;
      }
      return null;
    }

    getNodeAtRoute(route: Array<string>, routeKey?: string): Object | null {
      if (typeof route !== 'object' || !Array.isArray(route) || !route.length) {
        throw new Error('An array of route strings is required.');
      }

      const _routeKey = typeof routeKey === 'string' && routeKey.length ? routeKey : this._defaultKeys.id;
      let searchRoute = route.slice(0);
      let items = this._tree.childrenToArray(this._rootNode).slice(0);
      let foundItem = null;

      while (!foundItem && items.length > 0 && searchRoute.length > 0) {
        let item = items.shift();
        if (item[_routeKey] === searchRoute[0] && this._tree.childrenCount(item) > 0 && searchRoute.length !== 1) {
          searchRoute.shift();
          items = this._tree.childrenToArray(item).slice(0);
          continue;
        }
        if (item[_routeKey] === searchRoute[0] && searchRoute.length === 1) {
          foundItem = item;
          break;
        }
      }

      return foundItem;
    }

    /**
     * Returns a reference to the requested node's children. The returned array
     * will be empty if no children are defined.
     *
     * @param  {Object} node
     * @return {Array<Object>|null}
     */
    getChildren(node: Object | null): Array<Object> | null {
      const _node = (node === null) ? this._rootNode : node;
      if (_node && (_node.ROOT || this._tree.index(_node) > -1)) {
        return this._tree.childrenToArray(_node);
      }
      return null;
    }

    /**
     * Checks if the node has any children.
     *
     * @param  {Object} node
     * @return {boolean|null}
     */
    hasChildren(node: Object | null): boolean | null {
      const _node = (node === null) ? this._rootNode : node;
      if (_node && (_node.ROOT || this._tree.index(_node) > -1)) {
        return this._tree.childrenCount(_node) > 0;
      }
      return null;
    }

    /**
     * Adds a child or children to the requested node. Can pass a single object
     * to add one child, or an array of objects to add multiple children.
     * If `node` is null, the child object(s) will be added to the root of the graph.
     *
     * @param  {Object|null} node
     * @param  {Object|Array<Object>} children
     * @return {Array<Object>|undefined} the updated child array of the node
     */
    addChildren(node: Object | null, children: Object | Array<Object>, options?: { isExhausted?: boolean, recursive?: boolean,
    childrenKey?: boolean }): Array<Object> | null {
      if (typeof children !== 'object' || (Array.isArray(children) && !children.length)) {
        throw new Error('A child object or array of child objects is required.');
      }

      if (node !== null && typeof node === 'object' && !this.hasNode(node)) {
        throw new Error('The parent node must be a node in the graph or null.')
      }

      const parent = (node !== null) ? node : this._rootNode;
      const childArray = Array.isArray(children) ? children : [children];
      const childKey = (typeof options === 'object' && typeof options.childrenKey === 'string' && options.childrenKey.length)
        ? options.childrenKey : this._defaultKeys.children;
      const isRecursive = (typeof options === 'object' && typeof options.recursive === 'boolean')
        ? options.recursive : false;
      for (let i=0; i<children.length; i++) {
        const info = this._node(children[i]);
        info.isTerminal = children[i].hasOwnProperty('isTerminal') ? children[i].isTerminal : null;
        info.isExhausted = children[i].hasOwnProperty('isExhausted') ? children[i].isExhausted : null;
        this._tree.appendChild(parent, children[i]);
        if (isRecursive && typeof children[i][childKey] === 'object' && Array.isArray(children[i][childKey]) && children[i][childKey].length) {
          this.addChildren(children[i], children[i][childKey], { recursive: true });
        }
      }

      if (typeof options === 'object' && typeof options.isExhausted === 'boolean') {
        const isExhausted: boolean = options.isExhausted;
        const info = this._node(parent);
        info.isExhausted = isExhausted;
      }

      return this.getChildren(parent);
    }

    /**
     * Removes a child or children from the requested node. Can pass a single object
     * by reference to remove one child, or an array of objects by reference to
     * remove multiple children. If `node` is null, the child object(s) will be
     * removed from the root of the graph.
     *
     * @param  {Object|null} node
     * @param  {Object|Array<Object>} children
     * @return {Array<Object>|undefined} the updated child array of the node
     */
    // removeChildren(node: Object | null, children?: Object | Array<Object>, options?: { isExhausted: boolean }): Array<Object> | typeof undefined {
    //
    // }

    isExhausted(node: Object | null): boolean | null {
      const _node = (node === null) ? this._rootNode : node;
      if (_node && (_node.ROOT || this._tree.index(_node) > -1)) {
        const info = this._node(_node);
        return info && info.isExhausted === true ? true : false;
      }
      return null;
    }

    setExhausted(node: Object | null, isExhausted: boolean): boolean | null {
      const _node = (node === null) ? this._rootNode : node;
      if (_node && (_node.ROOT || this._tree.index(_node) > -1)) {
        const info = this._node(_node);
        info.isExhausted = isExhausted;
        return isExhausted;
      }
      return null;
    }

    isTerminal(node: Object | null): boolean | null {
      if (node === null) {
        // The root node can never be terminal, it must have children
        return false;
      }
      if (this._tree.index(node) > -1) {
        const info = this._node(node);
        return info && info.isTerminal === true ? true : false;
      }
      return null;
    }

    setTerminal(node: Object | null, isTerminal: boolean): boolean | null {
      if (node === null) {
        // The root node can never be terminal, it must have children
        throw new Error('The root node can never be terminal, it must have children.');
      }
      if (this._tree.index(node) > -1) {
        const info = this._node(node);
        info.isTerminal = isTerminal;
        return isTerminal;
      }
      return null;
    }

    static pathToRoute(path: Array<Object>, routeKey: string): Array<string|null> {
      return path.map(p => typeof p[routeKey] === 'string' && p[routeKey].length ? p[routeKey] : null);
    }
  };

  function assetGraph(options: Object): AssetGraph {
    return new AssetGraph(options);
  };

  const PxApp = window.PxApp = (window.PxApp || {});
  PxApp.AssetGraph = AssetGraph;
  PxApp.assetGraph = assetGraph;
})();
