function Ingredient(amount, item) {
    return {amount: amount, item: item};
}
function Requirement(rate, item, dependencies) {
    return {rate: rate, item: item, dependencies: dependencies};
}

function addCounts(a, b) {
    for (var name in b) {
        a[name] = (a[name] || 0) + b[name];
    }
}

function Item(name) {
    this.name = name;
    this.recipes = [];
}
Item.prototype = {
    constructor: Item,
    addRecipe: function(recipe) {
        this.recipes.push(recipe);
    },
    requirements: function(multiple) {
        var totals = {};
        var result = [];
        if (this.recipes.length == 0) {
            throw new Error("no recipes");
        }
        var recipe = this.recipes[0];
        for (var i in recipe.inputs) {
            var ingredient = recipe.inputs[i];
            var rate = ingredient.amount * multiple / recipe.gives(this);
            totals[ingredient.item.name] = (totals[ingredient.item.name] || 0) + rate;
            var reqs = ingredient.item.requirements(rate);
            result.push(Requirement(rate, ingredient.item, reqs[0]));
            addCounts(totals, reqs[1]);
        }
        return [result, totals];
    },
    factories: function(rate) {
        var recipe = this.recipes[0];
        return recipe.factories(rate / recipe.gives(this));
    },
    rate: function(factories) {
        var recipe = this.recipes[0];
        return recipe.rate() * factories;
    }
}

function Resource(name) {
    Item.call(this, name);
}
Resource.prototype = Object.create(Item.prototype);
Resource.prototype.requirements = function(multiple) {
    return [[], {}];
};
Resource.prototype.factories = function(rate) {
    return [null, null, null];
}
Resource.prototype.rate = function(factories) {
    return 1;
}

function getItems(data) {
    var categories = [];//["mining-tool", "repair-tool", "blueprint", "deconstruction-item", "item"];
    for (var x in data.raw["item-subgroup"]) {
        if (!(x in data.raw)) {
            continue;
        }
        categories.push(x);
    }
    var categories = categories.concat(["mining-tool", "repair-tool", "blueprint", "deconstruction-item", "item"]);
    items = {};
    for (var name in data.raw.resource) {
        items[name] = new Resource(name);
    }
    items.water = new Resource("water");
    items["alien-artifact"] = new Resource("alien-artifact");
    for (var i in categories) {
        var category = categories[i]
        for (var name in data.raw[category]) {
            if (name in items) {
                continue;
            }
            items[name] = new Item(name);
            /*if (items[name].recipes.length == 0) {
                throw new Error("blah");
            }*/
        }
    }
    return items;
}

function Recipe(name, time, inputs, outputs, factory) {
    this.name = name;
    this.time = time;
    this.inputs = inputs;
    this.outputs = outputs;
    this.factory = factory;
}
Recipe.prototype = {
    constructor: Recipe,
    rate: function() {
        return 60.0 / this.time * this.factory.speed;
    },
    factories: function(target_rate) {
        var rate = this.rate();
        var real = target_rate / rate;
        var factories = Math.floor(target_rate / rate)
        var fraction = target_rate % rate;
        if (fraction > 0) {
            factories += 1;
        }
        return [factories, real, this.factory.name];
    },
    gives: function(item) {
        for (var i in this.outputs) {
            var output = this.outputs[i]
            if (output.item == item) {
                return output.amount;
            }
        }
    }
}

function makeIngredient(i, items) {
    if (i.amount) {
        return Ingredient(i.amount, items[i.name]);
    } else {
        return Ingredient(i[1], items[i[0]]);
    }
}

function Factory(name, speed) {
    return {name: name, speed: speed};
}

var CATEGORY_SPEEDS = {
    chemistry: Factory("chemical-plant", 1.25),
    "oil-processing": Factory("oil-refinery", 1),
    smelting: Factory("furnace", 2),
    "rocket-building": Factory("rocket-silo", 1),
}

var ASSEMBLY_1 = Factory("assembling-machine", 0.5);
var ASSEMBLY_2 = Factory("assembling-machine-2", 0.75);
var ASSEMBLY_3 = Factory("assembling-machine-3", 1.25);

function makeRecipe(d, items, useFastest) {
    var time = d.energy_required || 0.5;
    var outputs;
    if ("result" in d) {
        outputs = [Ingredient(d.result_count || 1, items[d.result])]
    } else {
        outputs = []
        for (var i in d.results) {
            var x = d.results[i]
            outputs.push(Ingredient(x.amount, items[x.name]));
        }
    }
    var inputs = [];
    for (var i in d.ingredients) {
        inputs.push(makeIngredient(d.ingredients[i], items));
    }
    var factory = CATEGORY_SPEEDS[d["category"]]
    if (!factory) {
        if (useFastest) {
            factory = ASSEMBLY_3;
        } else if (inputs.length <= 2) {
            factory = ASSEMBLY_1;
        } else {
            factory = ASSEMBLY_2;
        }
    }
    return new Recipe(d.name, time, inputs, outputs, factory);
}

function getUnlockableRecipes(data) {
    var recipes = {}
    for (var name in data.raw.technology) {
        var info = data.raw.technology[name];
        for (var i in info.effects) {
            var effect = info.effects[i]
            if (effect.type == "unlock-recipe") {
                recipes[effect.recipe] = true;
            }
        }
    }
    return recipes
}

function getRecipeGraph(data, useFastest) {
    var unlockable = getUnlockableRecipes(data);
    var recipes = {};
    var items = getItems(data);

    for (var name in data.raw.recipe) {
        var recipe = data.raw.recipe[name];
        if (recipe.enabled != "false" || recipe.name in unlockable) {
            var r = makeRecipe(recipe, items, useFastest);
            recipes[recipe.name] = r;
            for (var i in r.outputs) {
                r.outputs[i].item.addRecipe(r);
            }
        }
    }
    return [items, recipes];
}

var stuff;

function loadStuff(callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open("GET", "stuff.json", true);
    xobj.onreadystatechange = function() {
        if (xobj.readyState == 4 && xobj.status == "200") {
            stuff = JSON.parse(xobj.responseText);
            callback(stuff);
        }
    };
    xobj.send(null);
}

var items;

function displaySteps(reqs, steps) {
    reqs.sort(function(a, b) {
        if (a.item.name < b.item.name) {
            return -1;
        } else if (a.item.name > b.item.name) {
            return 1;
        } else return 0;
    });
    for (var i=0; i < reqs.length; i++) {
        var req = reqs[i];
        var li = document.createElement("li");
        li.innerHTML = sprintf("<tt>%.3f</tt> %s", req.rate, req.item.name);
        steps.appendChild(li);
        if (req.dependencies.length > 0) {
            var subUL = document.createElement("ul");
            li.appendChild(subUL);
            displaySteps(req.dependencies, subUL);
        }
    }
}

function sorted(obj, compareFunc) {
    var keys = []
    for (var i in obj) {
        keys.push(i)
    }
    keys.sort(compareFunc)
    return keys
}

function displayReqs(item_name, rate, factories) {
    var item = items[item_name];
    if (factories) {
        rate = item.rate(factories);
        var rateBox = document.getElementById("rate");
        rateBox.value = rate;
    } else {
        factories = item.factories(rate)[0]
        var factoryBox = document.getElementById("factories");
        factoryBox.value = factories;
    }

    var reqs = item.requirements(rate);
    var requirements = reqs[0];
    var totals = reqs[1];

    var total_rate = document.getElementById("total_rate");
    total_rate.innerHTML = sprintf("%.3f", rate);
    var main_item = document.getElementById("main_item");
    main_item.innerHTML = item_name;
    var total_factories = document.getElementById("total_factories");
    total_factories.innerHTML = factories;

    var oldSteps = document.getElementById("steps");
    var newSteps = document.createElement("ul");
    newSteps.id = "steps";
    document.body.replaceChild(newSteps, oldSteps);

    displaySteps(requirements, newSteps);

    var oldTotals = document.getElementById("totals");
    var newTotals = document.createElement("table");
    newTotals.id = "totals";
    document.body.replaceChild(newTotals, oldTotals);
    
    var sorted_totals = sorted(totals)
    for (var i in sorted_totals) {
        var item = sorted_totals[i];
        var rate = totals[item];
        var row = document.createElement("tr");
        var rateCell = document.createElement("td");
        rateCell.className = "right-align";
        var nameCell = document.createElement("td");
        nameCell.className = "right-align";
        var factoryCell = document.createElement("td");
        row.appendChild(rateCell);
        row.appendChild(nameCell);
        row.appendChild(factoryCell);
        rateCell.innerHTML = sprintf("<tt>%.3f</tt>", rate);
        nameCell.innerHTML = item;
        
        factoryInfo = items[item].factories(rate);
        var factoryCount = factoryInfo[0];
        if (factoryCount) {
            factoryCell.innerHTML = sprintf("(%s x%d %.3f real)", factoryInfo[2], factoryCount, factoryInfo[1])
        }
        newTotals.appendChild(row);
    }
}

var changedFactory = true;

function itemUpdate() {
    var itemSelector = document.getElementById("item");
    var item = itemSelector.value;
    if (changedFactory) {
        var factories = document.getElementById("factories");
        displayReqs(item, null, factories.value);
    } else {
        var rate = document.getElementById("rate");
        displayReqs(item, rate.value, null);
    }
}

function threeUpdate() {
    var checkbox = document.getElementById("use_3");
    var graph = getRecipeGraph(stuff, checkbox.checked);
    items = graph[0];
    itemUpdate();
}

function factoryUpdate() {
    changedFactory = true;
    var factories = document.getElementById("factory_label");
    factories.className = "bold";
    var rate = document.getElementById("rate_label");
    rate.className = "";
    itemUpdate();
}

function rateUpdate() {
    changedFactory = false;
    var factories = document.getElementById("factory_label");
    factories.className = "";
    var rate = document.getElementById("rate_label");
    rate.className = "bold";
    itemUpdate();
}

function init() {
    loadStuff(function(data) {
        var graph = getRecipeGraph(data, false);

        items = graph[0];
        
        var defaultItem = "advanced-circuit";
        
        var itemSelector = document.getElementById("item")
        var sortedItems = sorted(items);
        for (var i=0; i<sortedItems.length; i++) {
            var item = sortedItems[i];
            var option = document.createElement("option");
            option.innerHTML = item;
            option.value = item;
            if (item == defaultItem) {
                option.selected = true;
            }
            itemSelector.appendChild(option)
        }

        //displayReqs(defaultItem);
        itemUpdate();
    });
}
