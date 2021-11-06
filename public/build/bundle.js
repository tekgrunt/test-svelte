
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.1' }, detail), true));
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/App.svelte generated by Svelte v3.44.1 */

    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = `Hello ${/*name*/ ctx[0]}!`;
    			add_location(h1, file, 4, 0, 41);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let name = 'world';
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ name });

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    //https://medium.com/@steveruiz/using-a-javascript-library-without-type-declarations-in-a-typescript-project-3643490015f3
    // const expect = require("chai").expect
    //import {Manager, Spout, Webhook} from 'limacharlie'
    // import Manager from limacharlie 
    // import Spout from limacharlie 
    // import Webhook from limacharlie 

    const OID = "c1de541c-a810-45dd-a22e-3e10f4d2e076";
    const API_KEY = "144814c0-71a0-44e8-a65d-bca6c7de8bec";

    function sleep(s) {
      return new Promise(resolve => setTimeout(resolve, s * 1000))
    }

    describe("Manager()", function () {
      this.timeout(5000);
      it("should test auth", async () => {
            
        const man = new Manager(OID, API_KEY);
        const isAuthed = await man.testAuth();
        expect(isAuthed).to.be.true;
      });
      it("should list sensors", async () => {
            
        const man = new Manager(OID, API_KEY);
        const sensors = await man.sensors();
        expect(sensors).to.not.have.lengthOf(0);
      });
    });

    describe("Sensor()", function() {
      this.timeout(30000);
      it("should get sensor info", async () => {
            
        const man = new Manager(OID, API_KEY);
        const sensors = await man.sensors();
        expect(sensors).to.not.have.lengthOf(0);
        const sensor = sensors[0];
        const info = await sensor.getInfo();
        expect(Object.keys(info)).to.not.have.lengthOf(0);
      });
      it("should update sensor tags", async () => {
        const testTag = "__test_tag";
        const man = new Manager(OID, API_KEY);
        const sensors = await man.sensors();
        expect(sensors).to.not.have.lengthOf(0);
        const sensor = sensors[0];
        const info = await sensor.getInfo();
        expect(Object.keys(info)).to.not.have.lengthOf(0);
        await sensor.tag(testTag, 30);
        sleep(2);
        let tags = await sensor.getTags();
        expect(tags).to.be.an("array").that.includes(testTag);
        await sensor.untag(testTag);
        sleep(2);
        tags = await sensor.getTags();
        expect(tags).to.be.an("array").that.does.not.include(testTag);
      });
      it("should task a sensor", async () => {
            
        const man = new Manager(OID, API_KEY);
        const sensors = await man.sensors();
        expect(sensors).to.not.have.lengthOf(0);
        const sensor = sensors[0];
        await sensor.task("dir_list / *");
      });
    });

    describe("Spout()", function() {
      this.timeout(90000);
      it("should get data from sensors", async () => {
        let feedData = [];
        const man = new Manager(OID, API_KEY);
        const spout = new Spout(man, "event", event => {
          feedData.push(event);
        }, error => {
          console.error(error);
        },
        null,   // Investigation ID
        null,   // Sensor Tag
        null);   // Detect Category
            
        await sleep(31);

        expect(feedData).to.not.have.lengthOf(0);

        spout.shutdown();

        await sleep(5);
        feedData = [];
        await sleep(5);

        expect(feedData).to.have.lengthOf(0);
      });
    });

    describe("Webhook()", function() {
      this.timeout(1000);
      it("should validate webhooks", () => {
        let sampleData = "{\"source\": \"5f6a41e7-49de-4fb0-9abb-b759e1613f9f.cef26d65-66ec-412c-a177-7ef631e08ebd.372390f9-e7a2-47bd-86ef-6549756d52e2.20000000.2\", \"detect\": {\"routing\": {\"hostname\": \"lc-1\", \"event_type\": \"STARTING_UP\", \"event_time\": 1528755862361, \"tags\": [\"test_tag_fd573ea7-1e00-41a1-b6d3-769800e93a42\"], \"event_id\": \"182a4785-b2cb-467f-8c6b-5c68c8bda609\", \"oid\": \"5f6a41e7-49de-4fb0-9abb-b759e1613f9f\", \"iid\": \"cef26d65-66ec-412c-a177-7ef631e08ebd\", \"plat\": 536870912, \"ext_ip\": \"127.0.0.1\", \"sid\": \"372390f9-e7a2-47bd-86ef-6549756d52e2\", \"int_ip\": \"172.16.223.219\", \"arch\": 2, \"moduleid\": 2}, \"event\": {}}, \"routing\": {\"hostname\": \"lc-1\", \"event_type\": \"STARTING_UP\", \"event_time\": 1528755862361, \"tags\": [\"test_tag_fd573ea7-1e00-41a1-b6d3-769800e93a42\"], \"event_id\": \"182a4785-b2cb-467f-8c6b-5c68c8bda609\", \"oid\": \"5f6a41e7-49de-4fb0-9abb-b759e1613f9f\", \"iid\": \"cef26d65-66ec-412c-a177-7ef631e08ebd\", \"plat\": 536870912, \"ext_ip\": \"127.0.0.1\", \"sid\": \"372390f9-e7a2-47bd-86ef-6549756d52e2\", \"int_ip\": \"172.16.223.219\", \"arch\": 2, \"moduleid\": 2}, \"detect_id\": \"9b856545-d762-438e-9771-e1a3eb04b66f\", \"cat\": \"test_detect\"}";
        let actualKey = "123";
        let goodSig = "3c046f332bb41e5c29a333847341276e688cd41c2c323f897e02c087daa09dcf";
        let badSig = "4c046f332bb41e5c29a333847341276e688cd41c2c323f897e02c087daa09dcd";

        let wh = new Webhook(actualKey);
        expect(wh.isSignatureValid(sampleData, goodSig)).to.be.true;
        expect(wh.isSignatureValid(sampleData, badSig)).to.be.false;
      });
    });


    var app = new App({
    	target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
