var db = firebase.firestore();

var provider = new firebase.auth.GithubAuthProvider();
var user;// = firebase.auth().currentUser;

var storage = firebase.storage();
var imagesRef = storage.ref("images")

var privateImages = [];
var publicImages = [];

var permissions;
var publicRef;
var privateRef;

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

document.getElementById("uploadBtn").addEventListener("click", () => {
    if (user) {
        file = document.getElementById("upload").files[0];
        var permission = permissions.PRIVATE;

        if (document.getElementById("permission").value == permissions.PUBLIC) {
            permission = permissions.PUBLIC;
        }

        var image = new Image(file.name, file.type, permission);
        saveImage(image, file);
    } else {
        throw "User must be logged in to upload images!";
    }
});

function saveImage(image, file) {
    if (user) {
        const uploadTask = storage.ref(`images/${image.permission}/${image.filename}`).put(file, file.type);


        // var uploadTask = privateRef.child(image.filename);

        // if (image.permission === permissions.PUBLIC) {
        //     uploadTask = publicRef.child(image.filename);
        // }

        // uploadTask.put(file, file.type);

        // switch(image.permission) {
        //     case permissions.PUBLIC:
        //         uploadTask = publicRef.child(image.filename).put(file, file.type);
        //     break;
        //     default:
        //         uploadTask = privateRef.child(image.filename).put(file, file.type);
        // }

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
        var deleteRef = privateRef.child(image.filename);

        if (image.permission === permissions.PUBLIC) {
            deleteRef = publicRef.child(image.filename);
        }

        // switch(image.permission) {
        //     case permissions.PUBLIC:
        //         deleteRef = publicRef.child(image.filename);
        //     break;
        //     default:
        //         deleteRef = privateRef.child(image.filename);
        // }

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
    permissions = {
        PUBLIC: "public"
    }

    publicRef = imagesRef.child("public");

    if (!user) {
        firebase.auth().getRedirectResult().then(result => {
            user = result.user;
        }).catch(error => console.error(error.message));
    }

    displayPublicImages();

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            globalThis.user = user;
            document.getElementById("authBtn").textContent = "Logout"
            
            privateRef = imagesRef.child(user.uid);
            permissions = {
                PUBLIC: "public",
                PRIVATE: user.uid
            };

            displayPrivateImages();
        } else {
            document.getElementById("authBtn").textContent = "Login"
        }
        console.info(`User: ${user ? user.displayName : "N/A"}, UID: ${user ? user.uid : "N/A"}`);
    });
}

document.getElementById("authBtn").addEventListener("click", () => {
    if (user) {
        firebase.auth().signOut().then(function() {
            user = null;
            location.reload(); // Refresh the page to clear everything and reinitialize
        }).catch(error => console.error(error.message));
    } else {
        firebase.auth().signInWithRedirect(provider).catch(error => console.error(error.message));
    }
});

document.getElementById("upload").addEventListener("change", () => {
    var filename = document.getElementById("upload").files[0].name;
    document.getElementById("upload-label").textContent = filename;
});