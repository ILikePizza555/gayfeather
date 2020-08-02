export type Entity = number;

export interface Component {
	tag: string
}

export interface TagComparison {
	operation: "is" | "is not" | "starts with";
	comparison: string;
}

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

export interface Query {
	readonly queryType: "single" | "many";

	testComponent(component: Component): boolean;
	run(components: Component[]): Component[] | Component;
}

export abstract class BaseQuery implements Query {
	abstract readonly queryType: "single" | "many";
	protected _queryTags: ReadonlyArray<TagComparison>;

	constructor(queryTags: ReadonlyArray<TagComparison>) {
		this._queryTags = this._queryTags;
	}

	public testComponent(component: Component): boolean {
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

	public abstract run(components: Component[]): Component[] | Component;
}

class SingleQuery extends BaseQuery {
	readonly queryType: "single" = "single";

	constructor(queryTags: ReadonlyArray<TagComparison>) {
		super(queryTags);
	}

	public run(component: Component[]): Component {
		return component.find(this.testComponent.bind(this));
	}
}

class ManyQuery extends BaseQuery {
	readonly queryType: "many" = "many";

	constructor( queryTags: ReadonlyArray<TagComparison>) {
		super(queryTags);
	}

	public run(component: Component[]): Component[] {
		return component.filter(this.testComponent.bind(this));
	}
}