import Either from "monio/either";
import IO from "monio/io";
import IOx from "monio/iox";
import {
	identity,
	isFunction,
	isMonad,
	curry,
} from "monio/util";


// ***********************************

findElement = curry(findElement,2);
findElements = curry(findElements,2);
closest = curry(closest,2);
matches = curry(matches,2);
appendChild = curry(appendChild,2);
setElProp = curry(setElProp,3);
getElProp = curry(getElProp,2);
setElAttr = curry(setElAttr,3);
getElAttr = curry(getElAttr,2);
addClass = curry(addClass,2);
removeClass = curry(removeClass,2);
setCSSVar = curry(setCSSVar,3);

const disableEl = setElProp("disabled",true);
const enableEl = setElProp("disabled",false);
const isEnabled = el => getElProp("disabled",el).map(v => !v);
const checkRadioButton = setElProp("checked",true);
const uncheckRadioButton = setElProp("checked",false);
const isChecked = getElProp("checked");
const setInnerText = setElProp("innerText");
const getInnerText = getElProp("innerText");
const setInnerHTML = setElProp("innerHTML");
const getInnerHTML = getElProp("innerHTML");

export {
	doIOBackground,
	doIOxBackground,
	getElement,
	findElement,
	findElements,
	closest,
	matches,
	createElement,
	appendChild,
	removeElement,
	setElProp,
	getElProp,
	setElAttr,
	getElAttr,
	setInnerText,
	getInnerText,
	setInnerHTML,
	getInnerHTML,
	disableEl,
	enableEl,
	isEnabled,
	checkRadioButton,
	uncheckRadioButton,
	isChecked,
	addClass,
	removeClass,
	setCSSVar,
	cancelEvent,
	requestJSON,
	reportError,
};


// ***********************************

function doIOBackground(gen,...args) {
	return IO(env => void(
		IO.do(gen,...args).run(env).catch(reportError)
	));
}

function doIOxBackground(gen,deps = [],...args) {
	return IO(env => void(
		IOx.do(gen,deps,...args).run(env).catch(reportError)
	));
}

function getElement(id) {
	return IO(({ doc, document, }) => (doc || document).getElementById(id));
}

function findElement(selector,parentEl) {
	return findElements(selector,parentEl).map(elements => elements[0]);
}

function findElements(selector,parentEl) {
	return IO(() => [ ...(parentEl.querySelectorAll(selector) || []) ]);
}

function closest(selector,el) {
	return IO(() => el.closest(selector));
}

function matches(selector,el) {
	return IO(() => el.matches(selector));
}

function createElement(type) {
	return IO(({ doc, }) => doc.createElement(type));
}

function appendChild(parentEl,childEl) {
	return IO(() => parentEl.appendChild(childEl));
}

function removeElement(el) {
	return IO(() => el.remove());
}

function setElProp(propName,val,el) {
	return IO(() => el[propName] = val);
}

function getElProp(propName,el) {
	return IO(() => el[propName]);
}

function setElAttr(attrName,val,el) {
	return IO(() => el.setAttribute(attrName,val));
}

function getElAttr(attrName,el) {
	return IO(() => el.getAttribute(attrName));
}

function addClass(className,el) {
	return IO(() => el.classList.add(className));
}

function removeClass(className,el) {
	return IO(() => el.classList.remove(className));
}

function setCSSVar(propName,value,el) {
	return IO(() => {
		if (el && el.style && el.style.setProperty) {
			el.style.setProperty(`--${propName}`,value);
		}
	});
}

function *cancelEvent(env,evt) {
	evt.preventDefault();
	evt.stopPropagation();
	evt.stopImmediatePropagation();
}

function requestJSON(url) {
	return IO(() => fetch(url).then(res => res.json()));
}

function reportError(err) {
	if (Either.Left.is(err)) {
		console.log(
			err.fold(identity,identity)
		);
	}
	else if (isMonad(err)) {
		console.log(err._inspect());
	}
	else if (isFunction(err.toString)) {
		console.log(err.toString());
	}
	else {
		console.log(err);
	}
}
