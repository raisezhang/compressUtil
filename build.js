
/**
 *  合并页面中所有的 js  & css
 *  @date 2015-01-15
 *  @author zhangqian@imakejoy.com
 *  @lang nodejs 
 *  
 *  http://blog.csdn.net/yuhui_fish/article/details/27656691
 *  http://www.xuebuyuan.com/230379.html
 *  
 *  
 *  npm install uglify-js@1
 *  npm install clean-css
 *  npm install node-smushit -g
 */


var fs = require('fs');
var jsp = require("uglify-js").parser;
var pro = require("uglify-js").uglify;
var CleanCSS = require('clean-css');
var smushit = require('node-smushit');

//root path
var rootPath = './WEB-INF/view',
	pckRootPath = "./pkg/",
	resPckRootPath = "/pkg/";

var imgPath = './img';
if (!fs.existsSync(pckRootPath)) {
	console.info('创建 pkg 文件夹：');
    if (!fs.mkdirSync(pckRootPath, 0777)) {
        console.error('pkg 创建失败~');
    } else {
    	console.log('pkg 创建成功~');
    }
}
console.log('js & css 压缩文件地址：', pckRootPath);
console.log('压缩中...');


function jsMinifier(fileIn, fileOut) {
    fileIn = Array.isArray(fileIn) ? fileIn : [fileIn];
    var origCode, ast, finalCode = '';
    for(var i = 0; i < fileIn.length; i++) {
    	origCode = fs.readFileSync(fileIn[i], 'utf8');
    	ast = jsp.parse(origCode);
    	ast = pro.ast_mangle(ast);
    	ast= pro.ast_squeeze(ast);
    	finalCode += ';' + pro.gen_code(ast);
	}
    fs.writeFileSync(fileOut, finalCode, 'utf8');
}

function cssMinifier(fileIn, fileOut) {
	fileIn = Array.isArray(fileIn) ? fileIn : [fileIn];
    var origCode,finalCode='';
    for(var i=0; i<fileIn.length; i++) {
    	origCode = fs.readFileSync(fileIn[i], 'utf8');
    	finalCode += new CleanCSS().minify(origCode).styles;; 
    }
   fs.writeFileSync(fileOut, finalCode, 'utf8');
}

function imgMinifier() {
	console.log('图片压缩中...');
	smushit.smushit(imgPath, {recursive: false});
	console.log('图片压缩成功!');
}

var regs = {
	scriptReg: /<script[^>]*>(.|\n)*?(?=<\/script>)<\/script>/gi,
	cssReg: /<link[^>]*\/>/gi,
	srcReg: /src=['"]([^'"]*)['"]/gi,
	hrefReg: /href=['"]([^'"]*)['"]/gi,
	typeReg: /type=['"]([^'"]*)['"]/gi
};

var utils = {
	getExtByPath: function(path) {
		var suffix = path.substring(path.lastIndexOf('.') + 1);
		return suffix;
	},
	getFileNameByPath: function(path) {
		var questionIndex = path.indexOf('?');
		if (questionIndex >= 0) {
			path = path.substring(0, questionIndex);
		}
		var lastSepIndex = path.lastIndexOf('/'),
		    fileName = path.substring(lastSepIndex + 1, path.lastIndexOf('.'));
		return fileName;
	},
	formatPath: function(path) {
		var questionIndex = path.indexOf('?');
		if (questionIndex >= 0) {
			path = path.substring(0, questionIndex);
		}
		return path;
	},
	getFilePathWithOutName: function(path) {
		var lastSepIndex = path.lastIndexOf('/'),
		    fileName = path.substring(0, lastSepIndex + 1);
		return fileName;
	},
	getTagList: function(path, tags, callback) {
		fs.readFile(path, "utf8", function(err, data){  
	        if(err) {
	            console.log("读取文件fail " + err);  
	        } else {
	        	var result = [];
	        	for (var i = 0; i < tags.length; i++) {
	        		result.push(data.match(regs[tags[i] + 'Reg']));
				}
	        	callback.call(null, result, data);
	        }
	    });
	}
};

var walk = function(path, floor, handleFile, async) {
	floor ++;
	var files = fs.readdirSync(path);
	files.forEach(function(item) {
		var tmpPath = path + '/' + item;
		var stats = fs.statSync(tmpPath);
		if (!stats.isDirectory()) {
			handleFile(tmpPath, floor, async);
		} else {
			walk(tmpPath, floor, handleFile, async);
		}
	});
};

/**
 * key   js1_js2_all.js
 * 		 css1_css2_all.css
 */
var resourceMap = {
	
};

var getResourceKey = function(filenames, type) {
	return filenames.join("_") + '_all.' + type;
};

var debug = false;


var filterResPath = function(path, srcPath) {
	if (srcPath.indexOf('http') === 0 || srcPath.indexOf('//') === 0) {
		return false;
	}
	srcPath = srcPath.replace('${CPATH}', '');
	srcPath = srcPath.replace('${CPATH!}', '');
	srcPath = utils.formatPath(srcPath);
	if (srcPath.indexOf('../') !== 0 && srcPath.indexOf('./') !== 0 && srcPath.indexOf('/') !== 0) {
		//srcPath = utils.getFilePathWithOutName(path) + srcPath;
	}
	if (srcPath.indexOf('/') !== 0) {
		srcPath = '/' + srcPath;
	}
	srcPath = '.' + srcPath;
	return srcPath;
};

var mergeAndCompressFile = function(type, path, list) {
	if (type === 'js') {
		jsMinifier(list, path);
	} else {
		cssMinifier(list, path);
	}
};

var mathRandom = Math.random();
var manageResource = function(path, type, scriptList, data) {
	var srcList = [],
		srcRegResult,
		reg,
		srcType,
		resPath;
	for ( var i = scriptList.length - 1; i >= 0; i--) {
		if (type === 'js') {
			reg = regs.srcReg;
		} else {
			reg = regs.hrefReg;
		}
		srcRegResult = reg.exec(scriptList[i]);
		regs.srcReg.lastIndex = 0;
		regs.hrefReg.lastIndex = 0;
		regs.typeReg.lastIndex = 0;
		srcType = regs.typeReg.exec(scriptList[i]);
		if(!srcRegResult || srcRegResult.length < 2 || !srcType || srcType.length < 2 ||
				((!(type === 'js' && srcType[1] === 'text/javascript')) &&
						(!(type === 'css' && srcType[1] === 'text/css'))) ||
				(!srcRegResult[1]) ||
				(!(resPath = filterResPath(path, srcRegResult[1])))) {
			scriptList.splice(i, 1);
			continue;
		}
		srcList.push(resPath);
	}
	
	if (srcList.length <= 0) {
		return data;
	}
	
	//console.log(srcList);
	var sortSrcList = srcList.slice(0);
	sortSrcList.sort();
	//console.log(sortSrcList);
	
	var fileNameList = [];
	for ( var i = 0; i < sortSrcList.length; i++) {
		fileNameList.push(utils.getFileNameByPath(sortSrcList[i]));
	}
	//console.log(fileNameList);
	var resourceKey = getResourceKey(fileNameList, type);
	//console.log(resourceKey);
	
	if (!resourceMap[resourceKey]) {
		resourceMap[resourceKey] = {
			//resList: scriptList,
			srcList: srcList.reverse(),
			url: resPckRootPath + resourceKey,
			path: path
		};
		mergeAndCompressFile(type, pckRootPath + resourceKey, resourceMap[resourceKey].srcList);
	}
	var replaceText = '',
		resourceUrl;
	for ( var i = 0; i < scriptList.length; i++) {
		if (i === 0) {
			resourceUrl = resourceMap[resourceKey].url + '?t=' + mathRandom;
			if (type === 'js') {
				replaceText = '<script type="text/javascript" src="' + resourceUrl + '"></script>';
			} else {
				replaceText = '<link href="' + resourceUrl + '" media="screen" rel="stylesheet" type="text/css" />';
			}
		} else {
			replaceText = '';
		}
		data = data.replace(scriptList[i], replaceText);
	}
	return data;
};

var timerId = -1;

var handleFile = function(path) {
	var ext = utils.getExtByPath(path);
	if (ext !== 'html') {
		return;
	}
	if (debug) {
		//return;
	}
	debug = true;
	utils.getTagList(path, ['script', 'css'], function(result, data) {
		var scriptList = result[0],
			cssList = result[1],
			hasChange = false;
		if (scriptList && scriptList.length > 0) {
			hasChange = true;
			data = manageResource(path, 'js', scriptList, data);
		}
		if (cssList && cssList.length > 0) {
			hasChange = true;
			data = manageResource(path, 'css', cssList, data);
		}
		if (hasChange) {
			fs.writeFile(path, data, function(err) {
	            if (err) {
	            	//console.error('error');
	            } else {
	            	clearTimeout(timerId);
	    			timerId = setTimeout(function() {
	    				console.log('js & css 压缩成功!');
	    				imgMinifier();
	    			}, 2000);
	            }
	        });
		}
	});
};
walk(rootPath, 0, handleFile);



