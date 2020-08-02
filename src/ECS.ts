import * as uuid from "uuid";

export type Entity = string;

export interface Component {
	tag: string
}

export interface TagComparison {
	operation: "is" | "is not" | "starts with";
	comparison: string;
}

// TODO: Queries aren't anything more than really complicated Array.filter operations right now.
// In the future, we want to make it so that the Engine can cache queries so that the entire component table
// Doesn't need to be iterated through every tick.

/**
 * Object that builds defines the requirements for a Query.
 */
export class QueryBuilder {
	queryType: "single" | "many"
	queryTags: TagComparison[]

	static One(): QueryBuilder {
		const rv = new QueryBuilder();
		rv.queryType = "single";
		return rv;
	}

	static Many(): QueryBuilder {
		const rv = new QueryBuilder();
		rv.queryType = "many"
		return rv;
	}

	public withTag(operation: "is" | "is not" | "starts with", comparison: string): this {
		this.queryTags.push({
			operation: operation,
			comparison: comparison
		});
		return this;
	}

	public build(): Query {
		if (this.queryType === "single") {
			return new SingleQuery(this.queryTags.slice());
		}
		else if (this.queryType === "many") {
			return new ManyQuery(this.queryTags.slice());
		}
	}
}

/**
 * An immutable object representing the requirements for components.
 */
export interface Query {
	readonly queryType: "single" | "many";

	/**
	 * Tests if the given component matches this query.
	 * 
	 * It is expected that any value which causes this method to return `true` is part of codomain of `run`.
	 * @param component 
	 */
	matches(component: Component): boolean;

	/**
	 * Runs this query on a set of components.
	 * @param components 
	 */
	run(components: Component[]): Component[] | Component;
}

export abstract class BaseQuery implements Query {
	abstract readonly queryType: "single" | "many";
	protected _queryTags: ReadonlyArray<TagComparison>;

	constructor(queryTags: ReadonlyArray<TagComparison>) {
		this._queryTags = this._queryTags;
	}

	public matches(component: Component): boolean {
		return this._queryTags.some(v => {
			if (v.operation === "is") {
				return component.tag === v.comparison;
			}
			else if (v.operation === "is not") {
				return component.tag !== v.comparison;
			}
			else if (v.operation === "starts with") {
				return component.tag.startsWith(v.comparison);
			}
			else {
				throw new Error(`Expected operation to be one of ["is", "is not", "starts with"] but got ${v.operation}`);
			}
		});
	}

	public abstract run(components: Component[]): Component[] | Component | undefined;
}

class SingleQuery extends BaseQuery {
	readonly queryType: "single" = "single";

	constructor(queryTags: ReadonlyArray<TagComparison>) {
		super(queryTags);
	}

	public run(component: Component[]): Component {
		return component.find(this.matches.bind(this));
	}
}

class ManyQuery extends BaseQuery {
	readonly queryType: "many" = "many";

	constructor( queryTags: ReadonlyArray<TagComparison>) {
		super(queryTags);
	}

	public run(component: Component[]): Component[] {
		return component.filter(this.matches.bind(this));
	}
}

/**
 * Defines a system. This is fundementally a function that operates on a set of Components.
 */
export interface System {
	/**
	 * Called once by the Engine when the system is first registered.
	 * @param engine 
	 */
	onInitialize(engine: Engine);

	/**
	 * Called 
	 * @param engine 
	 */
	tick(engine: Engine);
}

/**
 * The ECS engine.
 */
export class Engine {
	private _componentTable: Map<string, Component[]> = new Map<string, Component[]>();
	private _systems: System[] = [];

	private _getEntity(entity: Entity) {
		const rv = this._componentTable.get(entity);

		if (rv === undefined) {
			throw new Error(`Entity "${entity}" does not exist.`);
		}

		return rv;
	}

	public createEntity(): Entity {
		const entity = uuid.v4();
		this._componentTable.set(entity, []);
		return entity;
	}

	public removeEntity(entity: Entity) {
		this._componentTable.delete(entity);
	}

	public addComponent(entity: Entity, component: Component): number {
		return this._getEntity(entity).push(component);
	}

	public removeComponent(entity: Entity, component: Component) {
		const componentSet = this._getEntity(entity);
		const componentIndex = componentSet.indexOf(component);
		componentSet.splice(componentIndex);
	}

	public removeAllComponents(entity: Entity) {
		const componentSet = this._getEntity(entity);
		componentSet.splice(0, componentSet.length);
	}

	/**
	 * Runs a query on an entity and returns the matched components.
	 * @param entity 
	 * @param query 
	 */
	public queryEntity(entity: Entity, query: Query) {
		return query.run(this._getEntity(entity));
	}

	/**
	 * Returns a query on all entities and returns mapping of entities matched with their components.
	 * @param query 
	 */
	public queryAll(query: Query) {
		const rv: {[index: string]: Component | Component[]} = {}

		for (const [entity, entityComponents] of this._componentTable) {
			const matchedComponents = query.run(entityComponents);
			
			if (matchedComponents) {
				rv[entity] = matchedComponents;
			}
		}

		return rv;
	}

	public addSystem(system: System) {
		this._systems.push(system);
		system.onInitialize(this);
	}

	public tick() {
		for (const system of this._systems) {
			system.tick(this);
		}
	}
}