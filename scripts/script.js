var provider = new firebase.auth.GithubAuthProvider();
var user = firebase.auth().currentUser;

var storage = firebase.storage();
var imagesRef = storage.ref("images")

var publicRef = imagesRef.child("public");
var privateRef;
var privateImages = [];
var publicImages = [];

const permissions = {
    PUBLIC: "public",
    PRIVATE: user ? user.uid : null
};

class Image {
    constructor(filename, metadata, permission = permissions.PRIVATE, src = null, uploadDate = Date.now(), owner = user.uid) {
        this.filename = filename;
        this.metadata = metadata,
        this.permission = permission;
        this.src = src;
        this.uploadDate = uploadDate;
        this.owner = this.permission === permissions.PRIVATE ? null : owner;
    }
}

var imageConverter = {
    toFirestore: image => {
        return {
            filename: image.filename,
            metadata: image.metadata,
            permission: image.permission,
            src: image.src,
            uploadDate: image.uploadDate,
            owner: image.owner
        }
    },

    fromFirestore: (snapshot, options) => {
        const data = snapshot.data(options);
        return new Image(data.filename, data.metadata, data.permission, data.src, data.uploadDate, data.owner);
    }
};

function login() {
    firebase.auth().signInWithRedirect(provider).catch(error => console.error(error.message));
    firebase.auth().getRedirectResult().then(result => {
        console.info(`Redirect Result: ${result}`);
        console.info(`Got User: ${result.user}`);
        user = result.user;
    }).catch(error => console.error(error.message));
}

function logout() {
    firebase.auth().signOut().then(function() {
        location.reload(); // Refresh the page to clear everything and reinitialize
    }).catch(error => console.error(error.message));
}

function uploadImage(permission = permissions.PRIVATE) {
    if (user) {
        document.getElementById("upload").files.forEach(file => {
            var image = new Image(file.name, file.type, permission);
            saveImage(image, file);
        });
    } else {
        throw "User must be logged in to upload images!";
    }
}

function saveImage(image, file) {
    if (user) {
        var uploadTask;

        switch(image.permission) {
            case permissions.PUBLIC:
                uploadTask = publicRef.child(image.filename).put(file, file.type);
            break;
            default:
                uploadTask = privateRef.child(image.filename).put(file, file.type);
        }

        uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED, snapshot => { // Upload in progress
            console.info("Upload Progress: ${(snapshot.bytesTransferred / snapshot.totalBytes) * 100}%");
        }, error => { // Upload error
            console.error(error.code);
        }, () => { // Upload completed successfully
            uploadTask.snapshot.ref.getDownloadURL().then(url => {
                console.info(`Upload Successful, URL: ${url}`);

                image.src = url;
                db.collection(image.permission).doc(image.filename).withConverter(imageConverter).set(image);

                // db.collection(image.permission).doc(image.filename).set({
                //     src: url,
                //     metadata: img.metadata,
                //     uploadDate: image.uploadDate,
                //     owner: image.owner
                // });
            });
        });
    } else {
        throw "User must be logged in to save images!";
    }
}

function deleteImage(image) {
    if (user) {
        var deleteRef;

        switch(image.permission) {
            case permissions.PUBLIC:
                deleteRef = publicRef.child(image.filename);
            break;
            default:
                deleteRef = privateRef.child(image.filename);
        }

        // TODO: if db throws an error then we need to restore the image, since it'll be out of sync otherwise

        deleteRef.delete().then(() => {
            db.collection(image.permission).doc(image.filename).delete().then(() => {
                console.info("Successfully deleted");
            });
        });

        // TODO: we also need to update the UI (remove image from page to reflect changes)
    } else {
        throw "User must be logged in to delete images!";
    }
}

function loadPrivateImages() { // TODO: needs to be paginated (also maybe we should somehow merge the code into one? as this is duplicate code)
    if (user) {
        db.collection(permissions.PRIVATE).withConverter(imageConverter).onSnapshot(snapshot => {
            snapshot.forEach(doc => {
                privateImages.push(doc.data());
            });
        });
    } else {
        throw "User must be logged in to view private images!";
    }
    
    // privateRef.listAll().then(res => {
    //     res.items.forEach(itemRef => {
    //         itemRef.getDownloadURL().then(url => {
    //             var img = document.createElement("img");
    //             img.setAttribute("src", url);
    //             document.getElementById("private").appendChild(img);
    //         });
    //     });
    // });
}

function loadPublicImages() { // TODO: needs to be paginated, also the converter might not work
    db.collection(permissions.PUBLIC).withConverter(imageConverter).onSnapshot(snapshot => {
        snapshot.forEach(doc => {
            publicImages.push(doc.data());
        });
    });

    // publicRef.listAll().then(res => {
    //     res.items.forEach(itemRef => {
    //         itemRef.getDownloadURL().then(url => {
    //             var img = document.createElement("img");
    //             img.setAttribute("src", url);
    //             document.getElementById("public").appendChild(img);
    //         });
    //     });
    // });
}

function displayPrivateImages() {
    privateImages.forEach(image => {
        var img = document.createElement("img");
        img.setAttribute("src", image.src);
        document.getElementById("private").appendChild(img);
    });
}

function displayPublicImages() {
    publicImages.forEach(image => {
        var img = document.createElement("img");
        img.setAttribute("src", image.src);
        document.getElementById("public").appendChild(img);
    });
}

function initialize() {
    displayPublicImages();

    firebase.auth().onAuthStateChanged(() => {
        console.info(`User: ${user}`);
        if (user) {
            privateRef = imagesRef.child(user.uid);
            document.getElementById("authBtn").textContent = "Logout"
            displayPrivateImages();
        } else {
            document.getElementById("authBtn").textContent = "Login"
        }
    });
}

document.getElementById("authBtn").addEventListener("click", () => {
    if (user) {
        logout();
    } else {
        login();
    }
});

document.getElementById("upload").addEventListener("change", () => {
    var filename = document.getElementById("upload").files[0].name;
    // TODO: count extra files and display "filename + 5 more" for example
    document.getElementById("upload-label").textContent = filename;
});